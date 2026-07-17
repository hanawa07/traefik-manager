from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.manager_health_monitoring import read_external_watchdog_stale_minutes
from app.application.manager_http_error_monitoring import read_manager_http_error_monitor_status
from app.core.manager_watchdog_state import read_manager_watchdog_state
from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.infrastructure.docker.manager_http_log_reader import read_manager_http_error_preview
from app.infrastructure.github_actions_run import GitHubActionsRunStatusReader
from app.infrastructure.manager_deployment_history import (
    read_manager_deployment_history,
    read_manager_deployment_history_archive_with_summary,
)
from app.infrastructure.manager_deployment_bottleneck import (
    read_manager_deployment_bottleneck_state,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.docker_schemas import (
    DockerContainerListResponse,
    DockerDeploymentInfoResponse,
    ManagerHttpErrorPreviewRequest,
    ManagerHttpErrorPreviewResponse,
    ManagerHttpErrorSummaryResponse,
)

router = APIRouter()
MANAGER_HTTP_ERROR_WINDOW_OPTIONS = {6, 12, 24}
MAX_DEPLOYMENT_ALERT_RUNS = 5
DEPLOYMENT_ALERT_STATUS_FIELDS = {
    "alert_run_status": "external_watchdog_last_alert_run_status",
    "alert_run_conclusion": "external_watchdog_last_alert_run_conclusion",
    "alert_run_checked_at": "external_watchdog_last_alert_run_checked_at",
    "alert_run_error": "external_watchdog_last_alert_run_error",
}


def get_docker_client() -> DockerClient:
    return DockerClient()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


def _enrich_deployment_history(
    entries: list[dict[str, object]],
    run_statuses: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    enriched_entries = []
    for entry in entries:
        run_url = entry.get("alert_run_url")
        run_status = run_statuses.get(run_url) if isinstance(run_url, str) else None
        enriched_entries.append(
            {
                **entry,
                **{
                    target: run_status.get(source) if run_status else None
                    for target, source in DEPLOYMENT_ALERT_STATUS_FIELDS.items()
                },
            }
        )
    return enriched_entries


def _enrich_bottleneck_alert(
    alert: dict[str, object],
    run_statuses: dict[str, dict[str, object]],
) -> dict[str, object]:
    run_url = alert.get("run_url")
    run_status = run_statuses.get(run_url) if isinstance(run_url, str) else None
    return {
        **alert,
        "run_status": run_status.get("external_watchdog_last_alert_run_status") if run_status else None,
        "run_conclusion": run_status.get("external_watchdog_last_alert_run_conclusion") if run_status else None,
        "run_checked_at": run_status.get("external_watchdog_last_alert_run_checked_at") if run_status else None,
        "run_error": run_status.get("external_watchdog_last_alert_run_error") if run_status else None,
    }


@router.get("/containers", response_model=DockerContainerListResponse, summary="Docker 컨테이너 목록")
async def list_containers(
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    try:
        return await docker_client.list_container_candidates()
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Docker 컨테이너 목록을 가져오지 못했습니다",
        ) from exc


@router.get(
    "/http-errors",
    response_model=ManagerHttpErrorSummaryResponse,
    summary="Traefik Manager API 오류 추이",
)
async def get_manager_http_errors(
    window_hours: int = Query(default=24, ge=6, le=24),
    path: str | None = Query(default=None, max_length=200),
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    if window_hours not in MANAGER_HTTP_ERROR_WINDOW_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="조회 기간은 6, 12, 24시간만 선택할 수 있습니다",
        )
    try:
        return await docker_client.get_manager_http_error_summary(
            window_hours=window_hours,
            path_filter=path,
        )
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Manager API 오류 추이를 가져오지 못했습니다",
        ) from exc


@router.post(
    "/http-errors/preview",
    response_model=ManagerHttpErrorPreviewResponse,
    summary="Traefik Manager API 오류 임계치 미리보기",
)
async def preview_manager_http_errors(
    request: ManagerHttpErrorPreviewRequest,
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    return await read_manager_http_error_preview(
        docker_enabled=docker_client.enabled,
        window_minutes=request.window_minutes,
        excluded_paths=tuple(request.excluded_paths),
    )


@router.get("/deployment", response_model=DockerDeploymentInfoResponse, summary="Traefik Manager 배포 정보")
async def get_deployment_info(
    refresh_latest: bool = False,
    docker_client: DockerClient = Depends(get_docker_client),
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        deployment = await docker_client.get_manager_deployment_info(refresh_latest=refresh_latest)
        manager_route = await traefik_client.get_manager_route_status()
        settings_repo = SQLiteSystemSettingsRepository(db)
        stale_after_minutes = await read_external_watchdog_stale_minutes(settings_repo)
        http_error_monitor = await read_manager_http_error_monitor_status(settings_repo)
        watchdog_state = read_manager_watchdog_state(stale_after_minutes=stale_after_minutes)
        alert_runs = watchdog_state["external_watchdog_alert_runs"]
        last_run_url = watchdog_state["external_watchdog_last_alert_run_url"]
        deployment_history = read_manager_deployment_history()
        (
            deployment_history_archive,
            deployment_history_archive_summary,
        ) = read_manager_deployment_history_archive_with_summary()
        bottleneck_alert = read_manager_deployment_bottleneck_state()
        bottleneck_run_url = bottleneck_alert.get("run_url")
        deployment_alert_urls = list(
            dict.fromkeys(
                entry["alert_run_url"]
                for entry in [*deployment_history, *deployment_history_archive]
                if isinstance(entry.get("alert_run_url"), str)
            )
        )[:MAX_DEPLOYMENT_ALERT_RUNS]
        run_urls = list(dict.fromkeys([run["run_url"] for run in alert_runs]))
        if last_run_url and last_run_url not in run_urls:
            run_urls.append(last_run_url)
        run_urls.extend(url for url in deployment_alert_urls if url not in run_urls)
        if isinstance(bottleneck_run_url, str) and bottleneck_run_url not in run_urls:
            run_urls.append(bottleneck_run_url)
        reader = GitHubActionsRunStatusReader()
        run_statuses = await reader.get_statuses(run_urls)
        run_status = run_statuses.get(last_run_url) or await reader.get_status(last_run_url)
        enriched_alert_runs = [
            {
                **run,
                "status": run_statuses[run["run_url"]][
                    "external_watchdog_last_alert_run_status"
                ],
                "conclusion": run_statuses[run["run_url"]][
                    "external_watchdog_last_alert_run_conclusion"
                ],
                "checked_at": run_statuses[run["run_url"]][
                    "external_watchdog_last_alert_run_checked_at"
                ],
                "error": run_statuses[run["run_url"]][
                    "external_watchdog_last_alert_run_error"
                ],
            }
            for run in alert_runs
        ]
        return {
            **deployment,
            "manager_route": manager_route,
            **watchdog_state,
            **run_status,
            "http_error_monitor": http_error_monitor,
            "deployment_history": _enrich_deployment_history(
                deployment_history,
                run_statuses,
            ),
            "deployment_history_archive": _enrich_deployment_history(
                deployment_history_archive,
                run_statuses,
            ),
            "deployment_history_archive_summary": deployment_history_archive_summary,
            "deployment_bottleneck_alert": _enrich_bottleneck_alert(
                bottleneck_alert,
                run_statuses,
            ),
            "external_watchdog_alert_runs": enriched_alert_runs,
        }
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="배포 정보를 가져오지 못했습니다",
        ) from exc

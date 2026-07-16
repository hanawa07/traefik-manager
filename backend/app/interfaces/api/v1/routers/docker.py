from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.manager_health_monitoring import read_external_watchdog_stale_minutes
from app.application.manager_http_error_monitoring import read_manager_http_error_monitor_status
from app.core.manager_watchdog_state import read_manager_watchdog_state
from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.infrastructure.docker.manager_http_log_reader import read_manager_http_error_preview
from app.infrastructure.github_actions_run import GitHubActionsRunStatusReader
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


def get_docker_client() -> DockerClient:
    return DockerClient()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


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
        run_urls = list(dict.fromkeys([run["run_url"] for run in alert_runs]))
        if last_run_url and last_run_url not in run_urls:
            run_urls.append(last_run_url)
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
            "external_watchdog_alert_runs": enriched_alert_runs,
        }
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="배포 정보를 가져오지 못했습니다",
        ) from exc

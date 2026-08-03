from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.v1.schemas.manager_deployment_schemas import (
    DockerDeploymentInfoResponse,
)

MAX_DEPLOYMENT_ALERT_RUNS = 5
DEPLOYMENT_ALERT_STATUS_FIELDS = {
    "alert_run_status": "external_watchdog_last_alert_run_status",
    "alert_run_conclusion": "external_watchdog_last_alert_run_conclusion",
    "alert_run_checked_at": "external_watchdog_last_alert_run_checked_at",
    "alert_run_error": "external_watchdog_last_alert_run_error",
}


@dataclass(frozen=True)
class DockerDeploymentEndpoints:
    get_deployment_info: Callable[..., Any]


def register_docker_deployment_routes(
    router: APIRouter,
    *,
    get_docker_client: Callable[[], DockerClient],
    get_traefik_client: Callable[[], TraefikApiClient],
    current_user_dependency: Callable[..., Any],
    stale_minutes_reader_provider: Callable[[], Any],
    http_error_monitor_reader_provider: Callable[[], Any],
    settings_latency_reader_provider: Callable[[], Any],
    watchdog_state_reader_provider: Callable[[], Any],
    self_ban_state_reader_provider: Callable[[], Any],
    run_status_reader_provider: Callable[[], Any],
    deployment_history_reader_provider: Callable[[], Any],
    deployment_archive_reader_provider: Callable[[], Any],
    bottleneck_state_reader_provider: Callable[[], Any],
) -> DockerDeploymentEndpoints:
    @router.get(
        "/deployment",
        response_model=DockerDeploymentInfoResponse,
        summary="Traefik Manager 배포 정보",
    )
    async def get_deployment_info(
        refresh_latest: bool = False,
        docker_client: DockerClient = Depends(get_docker_client),
        traefik_client: TraefikApiClient = Depends(get_traefik_client),
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(current_user_dependency),
    ):
        try:
            deployment = await docker_client.get_manager_deployment_info(
                refresh_latest=refresh_latest
            )
            manager_route = await traefik_client.get_manager_route_status()
            settings_repo = SQLiteSystemSettingsRepository(db)
            stale_after_minutes = await stale_minutes_reader_provider()(settings_repo)
            http_error_monitor = await http_error_monitor_reader_provider()(settings_repo)
            settings_history_latency_monitor = await settings_latency_reader_provider()(
                settings_repo
            )
            watchdog_state = watchdog_state_reader_provider()(
                stale_after_minutes=stale_after_minutes
            )
            self_ban_state = self_ban_state_reader_provider()()
            alert_runs = watchdog_state["external_watchdog_alert_runs"]
            last_run_url = watchdog_state["external_watchdog_last_alert_run_url"]
            deployment_history = deployment_history_reader_provider()()
            (
                deployment_history_archive,
                deployment_history_archive_summary,
            ) = deployment_archive_reader_provider()()
            bottleneck_alert = bottleneck_state_reader_provider()()
            bottleneck_run_url = bottleneck_alert.get("run_url")
            bottleneck_storage_run_url = bottleneck_alert.get(
                "storage_warning_run_url"
            )
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
            if (
                isinstance(bottleneck_storage_run_url, str)
                and bottleneck_storage_run_url not in run_urls
            ):
                run_urls.append(bottleneck_storage_run_url)
            reader = run_status_reader_provider()
            run_statuses = await reader.get_statuses(run_urls)
            run_status = run_statuses.get(last_run_url) or await reader.get_status(
                last_run_url
            )
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
                "traefik_self_ban_watchdog": self_ban_state,
                **run_status,
                "http_error_monitor": http_error_monitor,
                "settings_history_latency_monitor": settings_history_latency_monitor,
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

    return DockerDeploymentEndpoints(get_deployment_info=get_deployment_info)


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
    storage_run_url = alert.get("storage_warning_run_url")
    storage_run_status = (
        run_statuses.get(storage_run_url) if isinstance(storage_run_url, str) else None
    )
    return {
        **alert,
        "run_status": run_status.get("external_watchdog_last_alert_run_status")
        if run_status
        else None,
        "run_conclusion": run_status.get("external_watchdog_last_alert_run_conclusion")
        if run_status
        else None,
        "run_checked_at": run_status.get("external_watchdog_last_alert_run_checked_at")
        if run_status
        else None,
        "run_error": run_status.get("external_watchdog_last_alert_run_error")
        if run_status
        else None,
        "storage_warning_run_status": storage_run_status.get(
            "external_watchdog_last_alert_run_status"
        )
        if storage_run_status
        else None,
        "storage_warning_run_conclusion": storage_run_status.get(
            "external_watchdog_last_alert_run_conclusion"
        )
        if storage_run_status
        else None,
        "storage_warning_run_checked_at": storage_run_status.get(
            "external_watchdog_last_alert_run_checked_at"
        )
        if storage_run_status
        else None,
        "storage_warning_run_error": storage_run_status.get(
            "external_watchdog_last_alert_run_error"
        )
        if storage_run_status
        else None,
    }

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.manager_http_request_log import (
    get_manager_http_request_log_status,
    read_manager_http_request_logs,
)
from app.infrastructure.docker.logs import read_docker_container_logs_text
from app.infrastructure.docker.manager_http_errors import (
    MANAGER_HTTP_ERROR_WINDOW_HOURS,
    build_manager_http_error_preview,
    build_manager_http_error_summary,
    count_manager_http_errors,
)


async def read_manager_http_error_summary(
    *,
    docker_enabled: bool,
    window_hours: int,
    path_filter: str | None = None,
) -> dict[str, object]:
    checked_at = datetime.now(timezone.utc)
    log_text, log_storage = await _read_request_logs(
        docker_enabled=docker_enabled,
        since=int((checked_at - timedelta(hours=window_hours)).timestamp()),
    )
    summary = build_manager_http_error_summary(
        log_text,
        checked_at=checked_at,
        window_hours=window_hours,
        path_filter=path_filter,
    )
    summary["log_storage"] = log_storage
    return summary


async def read_manager_http_error_counts(
    *,
    docker_enabled: bool,
    window_minutes: int,
    checked_at: datetime | None = None,
    excluded_paths: tuple[str, ...] = (),
) -> dict[str, object]:
    current = checked_at or datetime.now(timezone.utc)
    log_text, _ = await _read_request_logs(
        docker_enabled=docker_enabled,
        since=int((current - timedelta(minutes=window_minutes)).timestamp()),
    )
    return count_manager_http_errors(
        log_text,
        checked_at=current,
        window_minutes=window_minutes,
        excluded_paths=excluded_paths,
    )


async def read_manager_http_error_preview(
    *,
    docker_enabled: bool,
    window_minutes: int,
    excluded_paths: tuple[str, ...] = (),
    checked_at: datetime | None = None,
) -> dict[str, object]:
    current = checked_at or datetime.now(timezone.utc)
    log_text, _ = await _read_request_logs(
        docker_enabled=docker_enabled,
        since=int((current - timedelta(hours=MANAGER_HTTP_ERROR_WINDOW_HOURS)).timestamp()),
    )
    return build_manager_http_error_preview(
        log_text,
        checked_at=current,
        window_minutes=window_minutes,
        excluded_paths=excluded_paths,
    )


async def _read_request_logs(*, docker_enabled: bool, since: int) -> tuple[str | None, dict[str, object]]:
    status = get_manager_http_request_log_status(settings.TRAEFIK_MANAGER_REQUEST_LOG_PATH)
    log_text = read_manager_http_request_logs(settings.TRAEFIK_MANAGER_REQUEST_LOG_PATH)
    if log_text is not None:
        return log_text, {"source": "persistent", **status}
    if docker_enabled:
        log_text = await read_docker_container_logs_text(
            container_name=settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
            tail_lines=settings.TRAEFIK_MANAGER_LOG_TAIL_LINES,
            since=since,
        )
        if log_text is not None:
            return log_text, {"source": "docker", **status}
    return None, {"source": "unavailable", **status}

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.infrastructure.docker.logs import read_docker_container_logs_text
from app.infrastructure.docker.manager_http_errors import (
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
    log_text = None
    if docker_enabled:
        log_text = await read_docker_container_logs_text(
            container_name=settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
            tail_lines=settings.TRAEFIK_MANAGER_LOG_TAIL_LINES,
            since=int((checked_at - timedelta(hours=window_hours)).timestamp()),
        )
    return build_manager_http_error_summary(
        log_text,
        checked_at=checked_at,
        window_hours=window_hours,
        path_filter=path_filter,
    )


async def read_manager_http_error_counts(
    *,
    docker_enabled: bool,
    window_minutes: int,
    checked_at: datetime | None = None,
    excluded_paths: tuple[str, ...] = (),
) -> dict[str, object]:
    current = checked_at or datetime.now(timezone.utc)
    log_text = None
    if docker_enabled:
        log_text = await read_docker_container_logs_text(
            container_name=settings.TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME,
            tail_lines=settings.TRAEFIK_MANAGER_LOG_TAIL_LINES,
            since=int((current - timedelta(minutes=window_minutes)).timestamp()),
        )
    return count_manager_http_errors(
        log_text,
        checked_at=current,
        window_minutes=window_minutes,
        excluded_paths=excluded_paths,
    )

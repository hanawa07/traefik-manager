import asyncio
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.smoke_rotation_log import read_smoke_rotation_log_tail
from app.core.smoke_rotation_status import (
    SMOKE_ROTATION_DETAIL_KEY,
    SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY,
    SMOKE_ROTATION_LAST_SUCCESS_AT_KEY,
    SMOKE_ROTATION_STATUSES,
    SMOKE_ROTATION_STALE_AFTER_DAYS,
    SMOKE_ROTATION_STATUS_KEY,
    is_smoke_rotation_stale,
    is_smoke_success_stale,
)
from app.infrastructure.github_api_rate_limit import read_github_api_rate_limit
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.smoke_run_history import GitHubSmokeRunHistoryReader
from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    SMOKE_FAILURE_METADATA_LIMIT,
    attach_smoke_failure_metadata,
    read_smoke_failure_metadata,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    read_smoke_monitoring_values,
)
from app.interfaces.api.v1.routers.settings_smoke_run_status import read_smoke_run_status
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeRotationStatusResponse,
)

smoke_run_history_reader = GitHubSmokeRunHistoryReader()


async def get_smoke_rotation_status_response(
    db: AsyncSession,
    *,
    settings_repository_factory: Any = SQLiteSystemSettingsRepository,
    now: datetime | None = None,
    include_recent_logs: bool = False,
    include_monitoring_history: bool = False,
    monitoring_history_days: int | None = None,
    monitoring_history_page: int = 1,
    monitoring_history_search: str = "",
    monitoring_history_status: str = "all",
    force_refresh_monitoring_history: bool = False,
    history_reader: Any = smoke_run_history_reader,
) -> SmokeRotationStatusResponse:
    repo = settings_repository_factory(db)
    stored_status = ((await repo.get(SMOKE_ROTATION_STATUS_KEY)) or "never").strip()
    status = stored_status if stored_status in SMOKE_ROTATION_STATUSES else "never"
    last_success_at = await repo.get(SMOKE_ROTATION_LAST_SUCCESS_AT_KEY)
    log_lines: list[str] = []
    log_updated_at = None
    if include_recent_logs:
        log_lines, log_updated_at = await asyncio.to_thread(
            read_smoke_rotation_log_tail,
            settings.SMOKE_ROTATION_LOG_PATH,
        )
    monitoring = await read_smoke_monitoring_values(repo)
    run_status = await read_smoke_run_status(repo)
    admin_stale_after_days = 8 if monitoring["monitoring_frequency"] == "weekly" else 2
    admin_is_stale = monitoring["monitoring_enabled"] and is_smoke_success_stale(
        run_status["monitoring_admin_last_success_at"],
        stale_after_days=admin_stale_after_days,
        now=now,
    )
    history_days = monitoring_history_days or 30
    run_history = {
        "runs": [],
        "latest_failure": None,
        "checked_at": None,
        "recent_days": history_days,
        "page": monitoring_history_page,
        "per_page": 5,
        "total": 0,
        "total_pages": 0,
        "search": monitoring_history_search,
        "status_filter": monitoring_history_status,
        "error": None,
    }
    failure_metadata = {}
    if include_monitoring_history:
        run_history = await history_reader.get_history(
            settings.TRAEFIK_MANAGER_IMAGE_SOURCE,
            force_refresh=force_refresh_monitoring_history,
            recent_days=history_days,
            page=monitoring_history_page,
            search=monitoring_history_search,
            status_filter=monitoring_history_status,
        )
        failure_metadata = await read_smoke_failure_metadata(repo)
        attach_smoke_failure_metadata(
            run_history,
            failure_metadata,
        )
    github_rate_limit = (
        read_github_api_rate_limit()
        if include_monitoring_history
        else {"remaining": None, "limit": None, "reset_at": None}
    )
    return SmokeRotationStatusResponse(
        status=status,
        last_attempt_at=await repo.get(SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY),
        last_success_at=last_success_at,
        detail=await repo.get(SMOKE_ROTATION_DETAIL_KEY),
        is_stale=is_smoke_rotation_stale(last_success_at, now=now),
        stale_after_days=SMOKE_ROTATION_STALE_AFTER_DAYS,
        recent_log_lines=log_lines,
        log_updated_at=log_updated_at,
        **monitoring,
        **run_status,
        monitoring_admin_is_stale=admin_is_stale,
        monitoring_admin_stale_after_days=admin_stale_after_days,
        monitoring_recent_runs=run_history["runs"],
        monitoring_latest_failure=run_history["latest_failure"],
        monitoring_history_checked_at=run_history["checked_at"],
        monitoring_history_error=run_history["error"],
        monitoring_history_days=run_history["recent_days"],
        monitoring_history_page=run_history["page"],
        monitoring_history_per_page=run_history["per_page"],
        monitoring_history_total=run_history["total"],
        monitoring_history_total_pages=run_history["total_pages"],
        monitoring_history_search=run_history["search"],
        monitoring_history_status=run_history["status_filter"],
        monitoring_failure_metadata_count=len(failure_metadata),
        monitoring_failure_metadata_limit=SMOKE_FAILURE_METADATA_LIMIT,
        monitoring_github_rate_limit_remaining=github_rate_limit["remaining"],
        monitoring_github_rate_limit_limit=github_rate_limit["limit"],
        monitoring_github_rate_limit_reset_at=github_rate_limit["reset_at"],
    )

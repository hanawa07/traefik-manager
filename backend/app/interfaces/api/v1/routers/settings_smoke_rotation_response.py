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
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    read_smoke_monitoring_values,
)
from app.interfaces.api.v1.routers.settings_smoke_run_status import read_smoke_run_status
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeRotationStatusResponse,
)


async def get_smoke_rotation_status_response(
    db: AsyncSession,
    *,
    settings_repository_factory: Any = SQLiteSystemSettingsRepository,
    now: datetime | None = None,
    include_recent_logs: bool = False,
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
    )

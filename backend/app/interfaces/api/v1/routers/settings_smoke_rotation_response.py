from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.smoke_rotation_status import (
    SMOKE_ROTATION_DETAIL_KEY,
    SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY,
    SMOKE_ROTATION_LAST_SUCCESS_AT_KEY,
    SMOKE_ROTATION_STATUSES,
    SMOKE_ROTATION_STATUS_KEY,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeRotationStatusResponse,
)


async def get_smoke_rotation_status_response(
    db: AsyncSession,
    *,
    settings_repository_factory: Any = SQLiteSystemSettingsRepository,
) -> SmokeRotationStatusResponse:
    repo = settings_repository_factory(db)
    stored_status = ((await repo.get(SMOKE_ROTATION_STATUS_KEY)) or "never").strip()
    status = stored_status if stored_status in SMOKE_ROTATION_STATUSES else "never"
    return SmokeRotationStatusResponse(
        status=status,
        last_attempt_at=await repo.get(SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY),
        last_success_at=await repo.get(SMOKE_ROTATION_LAST_SUCCESS_AT_KEY),
        detail=await repo.get(SMOKE_ROTATION_DETAIL_KEY),
    )

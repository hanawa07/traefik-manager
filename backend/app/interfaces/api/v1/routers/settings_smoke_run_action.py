from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.interfaces.api.v1.routers.settings_smoke_failure_metadata import (
    record_smoke_failure_metadata,
)
from app.interfaces.api.v1.routers.settings_smoke_run_status import (
    record_smoke_run_success,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeMonitoringRunFailureRequest,
    SmokeMonitoringRunFailureResponse,
    SmokeMonitoringRunSuccessResponse,
)


async def record_smoke_run_success_action(
    *,
    run_id: int,
    actor: dict,
    db: AsyncSession,
    settings_repository_factory: Any,
    admin_checked: bool = False,
) -> SmokeMonitoringRunSuccessResponse:
    _require_smoke_viewer(actor)
    repo = settings_repository_factory(db)
    result = await record_smoke_run_success(
        repo,
        run_id=run_id,
        admin_checked=admin_checked,
    )
    return SmokeMonitoringRunSuccessResponse(**result)


async def record_smoke_run_failure_action(
    *,
    request: SmokeMonitoringRunFailureRequest,
    actor: dict,
    db: AsyncSession,
    settings_repository_factory: Any,
) -> SmokeMonitoringRunFailureResponse:
    _require_smoke_viewer(actor)
    repo = settings_repository_factory(db)
    result = await record_smoke_failure_metadata(
        repo,
        run_id=request.run_id,
        metadata=request.model_dump(mode="json", exclude={"run_id"}),
    )
    return SmokeMonitoringRunFailureResponse(**result)


def _require_smoke_viewer(actor: dict) -> None:
    if actor.get("role") != "viewer" or actor.get("username") != settings.SMOKE_VIEWER_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="전용 스모크 viewer만 실행 결과를 기록할 수 있습니다",
        )

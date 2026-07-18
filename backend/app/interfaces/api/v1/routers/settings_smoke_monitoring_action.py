from collections.abc import Callable
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    update_smoke_monitoring_values,
)
from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response,
)
from app.interfaces.api.v1.schemas.settings_smoke_rotation_schemas import (
    SmokeMonitoringSettingsUpdateRequest,
    SmokeRotationStatusResponse,
)


async def update_smoke_monitoring_settings_action(
    *,
    request: SmokeMonitoringSettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: Callable[[AsyncSession], Any],
    audit_service: Any,
    client_ip_getter: Callable[[Request | None], str | None],
) -> SmokeRotationStatusResponse:
    repo = settings_repository_factory(db)
    before, after = await update_smoke_monitoring_values(
        repo,
        enabled=request.monitoring_enabled,
        frequency=request.monitoring_frequency,
        failure_rate_threshold_percent=request.monitoring_failure_rate_threshold_percent,
        failure_rate_min_runs=request.monitoring_failure_rate_min_runs,
        failure_rate_window_days=request.monitoring_failure_rate_window_days,
    )
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["smoke_monitoring"],
        resource_name="운영 로그인·화면 점검 설정",
        before=before,
        after=after,
        client_ip=client_ip_getter(http_request),
    )
    return await get_smoke_rotation_status_response(
        db,
        settings_repository_factory=settings_repository_factory,
        include_recent_logs=True,
    )

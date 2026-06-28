from collections.abc import Callable

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_rollback
from app.interfaces.api.v1.routers.settings_rollback_helpers import (
    apply_settings_rollback,
    get_current_settings_summary_for_event,
    load_supported_settings_rollback,
)
from app.interfaces.api.v1.schemas.settings_schemas import SettingsRollbackActionResponse

SettingsRepositoryFactory = Callable[[AsyncSession], object]
ClientIpGetter = Callable[[Request | None], str | None]


async def rollback_settings_change_action(
    *,
    audit_log_id: str,
    http_request: Request,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: SettingsRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> SettingsRollbackActionResponse:
    audit_log, event, rollback_payload, rollback_event = await load_supported_settings_rollback(db, audit_log_id)
    repo = settings_repository_factory(db)
    before_state = await get_current_settings_summary_for_event(repo, event)
    after_state = await apply_settings_rollback(repo, event, rollback_payload)

    await record_settings_rollback(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        rollback_event=rollback_event,
        source_audit_id=audit_log_id,
        resource_name=audit_log.resource_name,
        before=before_state,
        after=after_state,
        client_ip=client_ip_getter(http_request),
    )
    return SettingsRollbackActionResponse(
        success=True,
        message=f"{audit_log.resource_name}을(를) 이전 상태로 되돌렸습니다",
        resource_name=audit_log.resource_name,
        event=rollback_event,
    )

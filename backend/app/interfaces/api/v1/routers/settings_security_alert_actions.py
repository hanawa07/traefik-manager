from collections.abc import Callable

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import (
    record_security_alert_test_audit,
    record_settings_update,
)
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_security_alert_update import update_security_alert_settings_values
from app.interfaces.api.v1.routers.settings_summary_helpers import security_alert_summary
from app.interfaces.api.v1.schemas.settings_schemas import (
    SecurityAlertSettingsResponse,
    SecurityAlertSettingsUpdateRequest,
    SettingsTestActionResponse,
)

SettingsRepositoryFactory = Callable[[AsyncSession], object]
ClientIpGetter = Callable[[Request | None], str | None]


async def test_security_alert_settings_action(
    *,
    request: Request,
    db: AsyncSession,
    actor: dict,
    notifier,
    audit_service,
    client_ip_getter: Callable[[Request], str],
) -> SettingsTestActionResponse:
    result = SettingsTestActionResponse(**(await notifier.send_test_alert(db)))
    await record_security_alert_test_audit(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        result=result,
        client_ip=client_ip_getter(request),
    )
    return result


async def test_smoke_admin_stale_alert_action(
    *,
    request: Request,
    db: AsyncSession,
    actor: dict,
    notifier,
    audit_service,
    client_ip_getter: Callable[[Request], str],
) -> SettingsTestActionResponse:
    result = SettingsTestActionResponse(
        **(await notifier.send_smoke_admin_stale_test_alert(db))
    )
    await record_security_alert_test_audit(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        result=result,
        client_ip=client_ip_getter(request),
        event_key="smoke_admin_stale",
        resource_name="관리자 지연 알림 dry-run",
    )
    return result


async def update_security_alert_settings_action(
    *,
    request: SecurityAlertSettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: SettingsRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> SecurityAlertSettingsResponse:
    repo = settings_repository_factory(db)
    previous_response, response = await update_security_alert_settings_values(repo, request)
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["security_alert"],
        resource_name="보안 알림 설정",
        before=security_alert_summary(previous_response),
        after=security_alert_summary(response),
        client_ip=client_ip_getter(http_request),
    )
    return response

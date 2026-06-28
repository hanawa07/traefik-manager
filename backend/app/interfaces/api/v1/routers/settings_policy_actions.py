from collections.abc import Callable
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_certificate_diagnostics_update import (
    update_certificate_diagnostics_settings_values,
)
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_summary_helpers import (
    certificate_diagnostics_summary,
    upstream_security_summary,
)
from app.interfaces.api.v1.routers.settings_time_display_response import build_time_display_response
from app.interfaces.api.v1.routers.settings_time_display_update import update_time_display_settings_value
from app.interfaces.api.v1.routers.settings_upstream_security_update import update_upstream_security_settings_values
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
)

RepositoryFactory = Callable[[AsyncSession], object]
ClientIpGetter = Callable[[Request | None], str | None]
ServerTimeContextGetter = Callable[[], dict[str, Any]]


async def update_time_display_settings_action(
    *,
    request: TimeDisplaySettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: RepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
    server_time_context_getter: ServerTimeContextGetter,
) -> TimeDisplaySettingsResponse:
    repo = settings_repository_factory(db)
    previous_value = await update_time_display_settings_value(repo, request.display_timezone)
    response = build_time_display_response(request.display_timezone, server_time_context_getter())
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["time_display"],
        resource_name="시간 표시 설정",
        before={"display_timezone": previous_value},
        after={"display_timezone": response.display_timezone},
        client_ip=client_ip_getter(http_request),
        rollback_payload={"display_timezone": previous_value},
    )
    return response


async def update_certificate_diagnostics_settings_action(
    *,
    request: CertificateDiagnosticsSettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: RepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> CertificateDiagnosticsSettingsResponse:
    repo = settings_repository_factory(db)
    previous_response, response = await update_certificate_diagnostics_settings_values(repo, request)
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["certificate_diagnostics"],
        resource_name="인증서 진단 설정",
        before=certificate_diagnostics_summary(previous_response),
        after=certificate_diagnostics_summary(response),
        client_ip=client_ip_getter(http_request),
    )
    return response


async def update_upstream_security_settings_action(
    *,
    request: UpstreamSecuritySettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: RepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> UpstreamSecuritySettingsResponse:
    repo = settings_repository_factory(db)
    previous_response, response, rollback_payload = await update_upstream_security_settings_values(repo, request)
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["upstream_security"],
        resource_name="업스트림 보안 설정",
        before=upstream_security_summary(previous_response),
        after=upstream_security_summary(response),
        client_ip=client_ip_getter(http_request),
        rollback_payload=rollback_payload,
    )
    return response

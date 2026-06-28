from collections.abc import Callable

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_summary_helpers import traefik_dashboard_summary
from app.interfaces.api.v1.routers.settings_traefik_dashboard_update import (
    ensure_dashboard_domain_is_available,
    update_traefik_dashboard_settings_values,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    TraefikDashboardSettingsResponse,
    TraefikDashboardSettingsUpdateRequest,
)

RepositoryFactory = Callable[[AsyncSession], object]
FileWriterFactory = Callable[[], object]
ClientIpGetter = Callable[[Request | None], str | None]


async def update_traefik_dashboard_settings_action(
    *,
    request: TraefikDashboardSettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: RepositoryFactory,
    service_repository_factory: RepositoryFactory,
    redirect_repository_factory: RepositoryFactory,
    file_writer_factory: FileWriterFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> TraefikDashboardSettingsResponse:
    repo = settings_repository_factory(db)
    previous_response, response, effective_password_hash = await update_traefik_dashboard_settings_values(
        repo,
        request,
        lambda domain: ensure_dashboard_domain_is_available(
            service_repository_factory(db),
            redirect_repository_factory(db),
            domain,
        ),
    )
    _write_traefik_dashboard_route(
        file_writer=file_writer_factory(),
        request=request,
        effective_password_hash=effective_password_hash,
    )

    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["traefik_dashboard"],
        resource_name="Traefik 디버그 대시보드 공개 설정",
        before=traefik_dashboard_summary(previous_response),
        after=traefik_dashboard_summary(response),
        client_ip=client_ip_getter(http_request),
    )
    return response


def _write_traefik_dashboard_route(
    *,
    file_writer,
    request: TraefikDashboardSettingsUpdateRequest,
    effective_password_hash: str,
) -> None:
    if request.enabled and request.domain and request.auth_username and effective_password_hash:
        file_writer.write_traefik_dashboard_public_route(
            domain=request.domain,
            basic_auth_username=request.auth_username,
            basic_auth_password_hash=effective_password_hash,
        )
        return

    file_writer.delete_traefik_dashboard_public_route()

from collections.abc import Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_route_registry import (
    SettingsReadRoute,
    SettingsUpdateRoute,
    execute_settings_read,
    execute_settings_update,
)
from app.interfaces.api.v1.routers.settings_route_specs import (
    build_settings_route_specs,
)


def build_default_settings_routes(
    *,
    server_time_context_getter_provider: Callable[[], Any],
    service_repository_factory_provider: Callable[[], Any],
    redirect_repository_factory_provider: Callable[[], Any],
    file_writer_factory_provider: Callable[[], Any],
):
    return build_settings_route_specs(
        server_time_context_getter_provider=server_time_context_getter_provider,
        service_repository_factory_provider=service_repository_factory_provider,
        redirect_repository_factory_provider=redirect_repository_factory_provider,
        file_writer_factory_provider=file_writer_factory_provider,
    )


async def read_settings_route(
    route: SettingsReadRoute,
    *,
    db: AsyncSession,
    settings_repository_factory: Any,
):
    return await execute_settings_read(
        route,
        db=db,
        settings_repository_factory=settings_repository_factory,
    )


async def update_settings_route(
    route: SettingsUpdateRoute,
    *,
    request: Any,
    http_request: Any,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: Any,
    audit_service: Any,
    client_ip_getter: Callable[[Any], str | None],
):
    return await execute_settings_update(
        route,
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=settings_repository_factory,
        audit_service=audit_service,
        client_ip_getter=client_ip_getter,
    )

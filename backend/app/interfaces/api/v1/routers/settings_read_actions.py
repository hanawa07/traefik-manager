from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_response_builders import (
    build_certificate_diagnostics_response,
    build_login_defense_response,
    build_security_alert_response,
    build_traefik_dashboard_response,
    build_upstream_security_response,
)
from app.interfaces.api.v1.routers.settings_time_display_response import build_time_display_response

SettingsRepositoryFactory = Callable[[AsyncSession], object]
ServerTimeContextGetter = Callable[[], dict[str, str]]


async def get_traefik_dashboard_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    repo = settings_repository_factory(db)
    return await build_traefik_dashboard_response(repo)


async def get_time_display_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
    server_time_context_getter: ServerTimeContextGetter,
):
    repo = settings_repository_factory(db)
    stored_timezone = await repo.get("display_timezone")
    return build_time_display_response(stored_timezone, server_time_context_getter())


async def get_certificate_diagnostics_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    repo = settings_repository_factory(db)
    return await build_certificate_diagnostics_response(repo)


async def get_upstream_security_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    repo = settings_repository_factory(db)
    return await build_upstream_security_response(repo)


async def get_login_defense_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    repo = settings_repository_factory(db)
    return await build_login_defense_response(repo)


async def get_security_alert_settings_action(
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    repo = settings_repository_factory(db)
    return await build_security_alert_response(repo)

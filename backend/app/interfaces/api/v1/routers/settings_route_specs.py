from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_login_defense_action import (
    update_login_defense_settings_action,
)
from app.interfaces.api.v1.routers.settings_policy_actions import (
    update_certificate_diagnostics_settings_action,
    update_time_display_settings_action,
    update_upstream_security_settings_action,
)
from app.interfaces.api.v1.routers.settings_read_actions import (
    get_certificate_diagnostics_settings_action,
    get_login_defense_settings_action,
    get_security_alert_settings_action,
    get_time_display_settings_action,
    get_traefik_dashboard_settings_action,
    get_upstream_security_settings_action,
)
from app.interfaces.api.v1.routers.settings_route_registry import SettingsReadRoute, SettingsUpdateRoute
from app.interfaces.api.v1.routers.settings_security_alert_actions import update_security_alert_settings_action
from app.interfaces.api.v1.routers.settings_traefik_dashboard_action import (
    update_traefik_dashboard_settings_action,
)

RepositoryFactory = Callable[[AsyncSession], object]
FileWriterFactory = Callable[[], object]
ServerTimeContextGetter = Callable[[], dict[str, Any]]


@dataclass(frozen=True)
class SettingsRouteSpecs:
    traefik_dashboard_read: SettingsReadRoute
    traefik_dashboard_update: SettingsUpdateRoute
    time_display_read: SettingsReadRoute
    time_display_update: SettingsUpdateRoute
    certificate_diagnostics_read: SettingsReadRoute
    certificate_diagnostics_update: SettingsUpdateRoute
    upstream_security_read: SettingsReadRoute
    upstream_security_update: SettingsUpdateRoute
    login_defense_read: SettingsReadRoute
    login_defense_update: SettingsUpdateRoute
    security_alert_read: SettingsReadRoute
    security_alert_update: SettingsUpdateRoute


def build_settings_route_specs(
    *,
    server_time_context_getter_provider: Callable[[], ServerTimeContextGetter],
    service_repository_factory_provider: Callable[[], RepositoryFactory],
    redirect_repository_factory_provider: Callable[[], RepositoryFactory],
    file_writer_factory_provider: Callable[[], FileWriterFactory],
) -> SettingsRouteSpecs:
    return SettingsRouteSpecs(
        traefik_dashboard_read=SettingsReadRoute(get_traefik_dashboard_settings_action),
        traefik_dashboard_update=SettingsUpdateRoute(
            update_traefik_dashboard_settings_action,
            lambda: {
                "service_repository_factory": service_repository_factory_provider(),
                "redirect_repository_factory": redirect_repository_factory_provider(),
                "file_writer_factory": file_writer_factory_provider(),
            },
        ),
        time_display_read=SettingsReadRoute(
            get_time_display_settings_action,
            lambda: {"server_time_context_getter": server_time_context_getter_provider()},
        ),
        time_display_update=SettingsUpdateRoute(
            update_time_display_settings_action,
            lambda: {"server_time_context_getter": server_time_context_getter_provider()},
        ),
        certificate_diagnostics_read=SettingsReadRoute(get_certificate_diagnostics_settings_action),
        certificate_diagnostics_update=SettingsUpdateRoute(update_certificate_diagnostics_settings_action),
        upstream_security_read=SettingsReadRoute(get_upstream_security_settings_action),
        upstream_security_update=SettingsUpdateRoute(update_upstream_security_settings_action),
        login_defense_read=SettingsReadRoute(get_login_defense_settings_action),
        login_defense_update=SettingsUpdateRoute(update_login_defense_settings_action),
        security_alert_read=SettingsReadRoute(get_security_alert_settings_action),
        security_alert_update=SettingsUpdateRoute(update_security_alert_settings_action),
    )

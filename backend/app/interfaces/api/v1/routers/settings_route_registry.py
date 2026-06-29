from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

SettingsRepositoryFactory = Callable[[AsyncSession], object]
SettingsDependenciesFactory = Callable[[], dict[str, Any]]
SettingsReadAction = Callable[..., Awaitable[Any]]
SettingsUpdateAction = Callable[..., Awaitable[Any]]
ClientIpGetter = Callable[[Request | None], str | None]


def _empty_dependencies() -> dict[str, Any]:
    return {}


@dataclass(frozen=True)
class SettingsReadRoute:
    action: SettingsReadAction
    dependencies_factory: SettingsDependenciesFactory = field(default_factory=lambda: _empty_dependencies)


@dataclass(frozen=True)
class SettingsUpdateRoute:
    action: SettingsUpdateAction
    dependencies_factory: SettingsDependenciesFactory = field(default_factory=lambda: _empty_dependencies)


async def execute_settings_read(
    route: SettingsReadRoute,
    *,
    db: AsyncSession,
    settings_repository_factory: SettingsRepositoryFactory,
):
    return await route.action(
        db=db,
        settings_repository_factory=settings_repository_factory,
        **route.dependencies_factory(),
    )


async def execute_settings_update(
    route: SettingsUpdateRoute,
    *,
    request,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: SettingsRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
):
    return await route.action(
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=settings_repository_factory,
        audit_service=audit_service,
        client_ip_getter=client_ip_getter,
        **route.dependencies_factory(),
    )

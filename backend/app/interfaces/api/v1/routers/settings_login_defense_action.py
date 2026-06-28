from collections.abc import Callable

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_login_defense_update import update_login_defense_settings_values
from app.interfaces.api.v1.routers.settings_summary_helpers import login_defense_summary
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
)

SettingsRepositoryFactory = Callable[[AsyncSession], object]
ClientIpGetter = Callable[[Request | None], str | None]


async def update_login_defense_settings_action(
    *,
    request: LoginDefenseSettingsUpdateRequest,
    http_request: Request | None,
    db: AsyncSession,
    actor: dict,
    settings_repository_factory: SettingsRepositoryFactory,
    audit_service,
    client_ip_getter: ClientIpGetter,
) -> LoginDefenseSettingsResponse:
    repo = settings_repository_factory(db)
    previous_response, response = await update_login_defense_settings_values(repo, request)
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["login_defense"],
        resource_name="로그인 방어 설정",
        before=login_defense_summary(previous_response),
        after=login_defense_summary(response),
        client_ip=client_ip_getter(http_request),
    )
    return response

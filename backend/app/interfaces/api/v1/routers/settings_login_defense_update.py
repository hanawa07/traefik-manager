from fastapi import HTTPException

from app.core.config import settings
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_login_defense_response import build_login_defense_response
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
)


async def update_login_defense_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: LoginDefenseSettingsUpdateRequest,
) -> tuple[LoginDefenseSettingsResponse, LoginDefenseSettingsResponse]:
    previous_response = await build_login_defense_response(repo)
    existing_turnstile_secret = await repo.get("login_turnstile_secret_key")
    effective_turnstile_secret = request.turnstile_secret_key or existing_turnstile_secret or ""
    turnstile_enabled = request.turnstile_mode != "off"

    if turnstile_enabled and (not request.turnstile_site_key or not effective_turnstile_secret):
        raise HTTPException(status_code=422, detail="Turnstile site key와 secret key가 필요합니다")
    if (
        request.suspicious_block_escalation_enabled
        and request.suspicious_block_max_minutes < settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES
    ):
        raise HTTPException(status_code=422, detail="차단 최대 시간은 기본 차단 시간보다 작을 수 없습니다")

    await repo.set("login_suspicious_block_enabled", "true" if request.suspicious_block_enabled else "false")
    await repo.set("login_suspicious_trusted_networks", "\n".join(request.suspicious_trusted_networks) or None)
    await repo.set(
        "login_suspicious_block_escalation_enabled",
        "true" if request.suspicious_block_escalation_enabled else "false",
    )
    await repo.set(
        "login_suspicious_block_escalation_window_minutes",
        str(request.suspicious_block_escalation_window_minutes),
    )
    await repo.set(
        "login_suspicious_block_escalation_multiplier",
        str(request.suspicious_block_escalation_multiplier),
    )
    await repo.set("login_suspicious_block_max_minutes", str(request.suspicious_block_max_minutes))
    await repo.set("login_turnstile_mode", request.turnstile_mode)
    await repo.set("login_turnstile_enabled", "true" if turnstile_enabled else "false")
    await repo.set("login_turnstile_site_key", request.turnstile_site_key or None)
    if request.turnstile_secret_key:
        await repo.set("login_turnstile_secret_key", request.turnstile_secret_key)

    return previous_response, await build_login_defense_response(repo)

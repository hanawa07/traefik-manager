from app.core.config import settings
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_value_helpers import (
    get_bool_setting,
    get_int_setting,
    get_turnstile_mode,
    split_networks,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsResponse,
    normalize_trusted_networks,
)


async def build_login_defense_response(
    repo: SQLiteSystemSettingsRepository,
) -> LoginDefenseSettingsResponse:
    turnstile_secret_key = await repo.get("login_turnstile_secret_key")
    turnstile_mode = await get_turnstile_mode(repo)
    return LoginDefenseSettingsResponse(
        max_failed_attempts=settings.LOGIN_MAX_FAILED_ATTEMPTS,
        failure_window_minutes=settings.LOGIN_FAILURE_WINDOW_MINUTES,
        lockout_minutes=settings.LOGIN_LOCKOUT_MINUTES,
        suspicious_window_minutes=settings.LOGIN_SUSPICIOUS_WINDOW_MINUTES,
        suspicious_failure_count=settings.LOGIN_SUSPICIOUS_FAILURE_COUNT,
        suspicious_username_count=settings.LOGIN_SUSPICIOUS_USERNAME_COUNT,
        suspicious_block_minutes=settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES,
        suspicious_block_enabled=await get_bool_setting(
            repo,
            "login_suspicious_block_enabled",
            default=True,
        ),
        suspicious_trusted_networks=normalize_trusted_networks(
            split_networks(await repo.get("login_suspicious_trusted_networks"))
        ),
        suspicious_block_escalation_enabled=await get_bool_setting(
            repo,
            "login_suspicious_block_escalation_enabled",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED,
        ),
        suspicious_block_escalation_window_minutes=await get_int_setting(
            repo,
            "login_suspicious_block_escalation_window_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES,
        ),
        suspicious_block_escalation_multiplier=await get_int_setting(
            repo,
            "login_suspicious_block_escalation_multiplier",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER,
        ),
        suspicious_block_max_minutes=await get_int_setting(
            repo,
            "login_suspicious_block_max_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES,
        ),
        turnstile_mode=turnstile_mode,
        turnstile_enabled=turnstile_mode != "off",
        turnstile_site_key=await repo.get("login_turnstile_site_key"),
        turnstile_secret_key_configured=bool(turnstile_secret_key),
    )

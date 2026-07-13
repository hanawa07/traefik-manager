from app.application.manager_health_monitoring import (
    read_external_watchdog_stale_minutes,
    read_manager_health_monitoring_values,
)
from app.core.config import settings
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_security_alert_helpers import (
    SECURITY_ALERT_EVENTS,
    SECURITY_ALERT_PROVIDERS,
    build_change_alert_event_routes,
    build_security_alert_event_routes,
)
from app.interfaces.api.v1.routers.settings_value_helpers import get_bool_setting, split_networks
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsResponse


async def build_security_alert_response(
    repo: SQLiteSystemSettingsRepository,
) -> SecurityAlertSettingsResponse:
    manager_health_enabled, manager_health_cooldown_minutes = (
        await read_manager_health_monitoring_values(repo)
    )
    external_watchdog_stale_minutes = await read_external_watchdog_stale_minutes(repo)
    provider = await repo.get("security_alert_provider") or "generic"
    telegram_bot_token = await repo.get("security_alert_telegram_bot_token")
    pagerduty_routing_key = await repo.get("security_alert_pagerduty_routing_key")
    email_password = await repo.get("security_alert_email_password")
    email_port_value = await repo.get("security_alert_email_port")
    try:
        email_port = int(email_port_value) if email_port_value else 587
    except ValueError:
        email_port = 587
    return SecurityAlertSettingsResponse(
        enabled=await get_bool_setting(
            repo,
            "security_alerts_enabled",
            default=False,
        ),
        change_alerts_enabled=await get_bool_setting(
            repo,
            "change_alerts_enabled",
            default=False,
        ),
        manager_health_monitoring_enabled=manager_health_enabled,
        manager_health_alert_cooldown_minutes=manager_health_cooldown_minutes,
        external_watchdog_stale_minutes=external_watchdog_stale_minutes,
        provider=provider if provider in SECURITY_ALERT_PROVIDERS else "generic",
        webhook_url=await repo.get("security_alert_webhook_url"),
        telegram_bot_token_configured=bool(telegram_bot_token),
        telegram_chat_id=await repo.get("security_alert_telegram_chat_id"),
        pagerduty_routing_key_configured=bool(pagerduty_routing_key),
        email_host=await repo.get("security_alert_email_host"),
        email_port=email_port,
        email_security=((await repo.get("security_alert_email_security")) or "starttls"),
        email_username=await repo.get("security_alert_email_username"),
        email_password_configured=bool(email_password),
        email_from=await repo.get("security_alert_email_from"),
        email_recipients=split_networks(await repo.get("security_alert_email_recipients")),
        timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
        alert_events=SECURITY_ALERT_EVENTS,
        event_routes=await build_security_alert_event_routes(repo),
        change_event_routes=await build_change_alert_event_routes(repo),
    )

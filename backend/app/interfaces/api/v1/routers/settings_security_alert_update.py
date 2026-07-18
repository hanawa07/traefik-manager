from fastapi import HTTPException

from app.application.manager_health_monitoring import (
    EXTERNAL_WATCHDOG_STALE_MINUTES_KEY,
    MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES_KEY,
    MANAGER_HEALTH_MONITORING_ENABLED_KEY,
)
from app.application.manager_http_error_monitoring import (
    MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY,
    MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY,
    MANAGER_HTTP_EXCLUDED_PATHS_KEY,
    MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY,
    MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_security_alert_response import build_security_alert_response
from app.interfaces.api.v1.routers.settings_security_alert_helpers import (
    CHANGE_ALERT_EVENTS,
    SECURITY_ALERT_EVENTS,
    SECURITY_ALERT_PROVIDERS,
    normalize_change_alert_event_routes,
    normalize_security_alert_event_routes,
    resolve_security_alert_provider,
    validate_security_alert_provider_config,
)
from app.interfaces.api.v1.schemas.settings_security_alert_schemas import (
    AUTOMATIC_RETRY_DELAY_WARNING_MINUTES_KEY,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    SecurityAlertSettingsResponse,
    SecurityAlertSettingsUpdateRequest,
)


async def update_security_alert_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: SecurityAlertSettingsUpdateRequest,
) -> tuple[SecurityAlertSettingsResponse, SecurityAlertSettingsResponse]:
    previous_response = await build_security_alert_response(repo)
    if request.provider not in SECURITY_ALERT_PROVIDERS:
        raise HTTPException(status_code=422, detail="지원하지 않는 보안 알림 provider입니다")

    normalized_event_routes = normalize_security_alert_event_routes(request.event_routes)
    normalized_change_event_routes = normalize_change_alert_event_routes(request.change_event_routes)

    existing_telegram_bot_token = await repo.get("security_alert_telegram_bot_token")
    effective_telegram_bot_token = request.telegram_bot_token or existing_telegram_bot_token or ""
    existing_pagerduty_routing_key = await repo.get("security_alert_pagerduty_routing_key")
    effective_pagerduty_routing_key = request.pagerduty_routing_key or existing_pagerduty_routing_key or ""
    existing_email_password = await repo.get("security_alert_email_password")
    effective_email_password = request.email_password or existing_email_password or ""

    if request.enabled:
        for event_name in SECURITY_ALERT_EVENTS:
            effective_provider = resolve_security_alert_provider(
                request.provider,
                normalized_event_routes[event_name],
            )
            if effective_provider is None:
                continue
            validate_security_alert_provider_config(
                provider=effective_provider,
                request=request,
                effective_telegram_bot_token=effective_telegram_bot_token,
                effective_pagerduty_routing_key=effective_pagerduty_routing_key,
                effective_email_password=effective_email_password,
            )
    if request.change_alerts_enabled:
        for event_name in CHANGE_ALERT_EVENTS:
            effective_provider = resolve_security_alert_provider(
                request.provider,
                normalized_change_event_routes[event_name],
            )
            if effective_provider is None:
                continue
            validate_security_alert_provider_config(
                provider=effective_provider,
                request=request,
                effective_telegram_bot_token=effective_telegram_bot_token,
                effective_pagerduty_routing_key=effective_pagerduty_routing_key,
                effective_email_password=effective_email_password,
            )

    await repo.set("security_alerts_enabled", "true" if request.enabled else "false")
    await repo.set("change_alerts_enabled", "true" if request.change_alerts_enabled else "false")
    await repo.set(
        MANAGER_HEALTH_MONITORING_ENABLED_KEY,
        "true" if request.manager_health_monitoring_enabled else "false",
    )
    await repo.set(
        MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES_KEY,
        str(request.manager_health_alert_cooldown_minutes),
    )
    await repo.set(
        EXTERNAL_WATCHDOG_STALE_MINUTES_KEY,
        str(request.external_watchdog_stale_minutes),
    )
    await repo.set(
        AUTOMATIC_RETRY_DELAY_WARNING_MINUTES_KEY,
        str(request.automatic_retry_delay_warning_minutes),
    )
    await repo.set(
        MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY,
        "true" if request.manager_http_error_monitoring_enabled else "false",
    )
    await repo.set(
        MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY,
        str(request.manager_http_error_window_minutes),
    )
    await repo.set(
        MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY,
        str(request.manager_http_not_found_threshold),
    )
    await repo.set(
        MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY,
        str(request.manager_http_server_error_threshold),
    )
    await repo.set(
        MANAGER_HTTP_EXCLUDED_PATHS_KEY,
        "\n".join(request.manager_http_excluded_paths) or None,
    )
    await repo.set("security_alert_provider", request.provider)
    await repo.set("security_alert_webhook_url", request.webhook_url or None)
    for event_name in SECURITY_ALERT_EVENTS:
        await repo.set(f"security_alert_route_{event_name}", normalized_event_routes[event_name])
    for event_name in CHANGE_ALERT_EVENTS:
        await repo.set(f"security_alert_change_route_{event_name}", normalized_change_event_routes[event_name])
    if request.telegram_bot_token:
        await repo.set("security_alert_telegram_bot_token", request.telegram_bot_token)
    await repo.set("security_alert_telegram_chat_id", request.telegram_chat_id or None)
    if request.pagerduty_routing_key:
        await repo.set("security_alert_pagerduty_routing_key", request.pagerduty_routing_key)
    await repo.set("security_alert_email_host", request.email_host or None)
    await repo.set("security_alert_email_port", str(request.email_port))
    await repo.set("security_alert_email_security", request.email_security)
    await repo.set("security_alert_email_username", request.email_username or None)
    if request.email_password:
        await repo.set("security_alert_email_password", request.email_password)
    await repo.set("security_alert_email_from", request.email_from or None)
    await repo.set("security_alert_email_recipients", "\n".join(request.email_recipients) or None)

    return previous_response, await build_security_alert_response(repo)

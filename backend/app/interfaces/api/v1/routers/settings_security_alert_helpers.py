from fastapi import HTTPException

from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsUpdateRequest

SECURITY_ALERT_EVENTS = ["login_locked", "login_suspicious", "login_blocked_ip"]
CHANGE_ALERT_EVENTS = [
    "settings_change",
    "service_change",
    "redirect_change",
    "middleware_change",
    "user_change",
    "certificate_status_change",
    "certificate_preflight_failure",
    "manager_health",
    "rollback",
]
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"}
SECURITY_ALERT_ROUTE_TARGETS = {"default", "disabled", "telegram", "pagerduty", "email"}


async def build_security_alert_event_routes(
    repo: SQLiteSystemSettingsRepository,
) -> dict[str, str]:
    routes: dict[str, str] = {}
    for event_name in SECURITY_ALERT_EVENTS:
        stored_route = ((await repo.get(f"security_alert_route_{event_name}")) or "default").strip().lower()
        routes[event_name] = stored_route if stored_route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return routes


async def build_change_alert_event_routes(
    repo: SQLiteSystemSettingsRepository,
) -> dict[str, str]:
    routes: dict[str, str] = {}
    for event_name in CHANGE_ALERT_EVENTS:
        stored_route = await get_change_alert_route_value(repo, event_name)
        routes[event_name] = stored_route if stored_route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return routes


def normalize_security_alert_event_routes(event_routes: dict[str, str]) -> dict[str, str]:
    normalized = {event_name: "default" for event_name in SECURITY_ALERT_EVENTS}
    for event_name, route in event_routes.items():
        normalized[event_name] = route if route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return normalized


def normalize_change_alert_event_routes(event_routes: dict[str, str]) -> dict[str, str]:
    normalized = {event_name: "default" for event_name in CHANGE_ALERT_EVENTS}
    for event_name, route in event_routes.items():
        normalized[event_name] = route if route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return normalized


async def get_change_alert_route_value(
    repo: SQLiteSystemSettingsRepository,
    event_name: str,
) -> str:
    stored_route = ((await repo.get(f"security_alert_change_route_{event_name}")) or "").strip().lower()
    if stored_route:
        return stored_route
    if event_name in {"certificate_status_change", "certificate_preflight_failure"}:
        legacy_route = ((await repo.get("security_alert_change_route_certificate_change")) or "").strip().lower()
        if legacy_route:
            return legacy_route
    return "default"


def resolve_security_alert_provider(default_provider: str, route_target: str) -> str | None:
    if route_target == "disabled":
        return None
    if route_target == "default":
        return default_provider
    return route_target


def validate_security_alert_provider_config(
    *,
    provider: str,
    request: SecurityAlertSettingsUpdateRequest,
    effective_telegram_bot_token: str,
    effective_pagerduty_routing_key: str,
    effective_email_password: str,
) -> None:
    if provider == "telegram":
        if not effective_telegram_bot_token or not request.telegram_chat_id:
            raise HTTPException(status_code=422, detail="Telegram bot token과 chat id가 필요합니다")
        return
    if provider == "pagerduty":
        if not effective_pagerduty_routing_key:
            raise HTTPException(status_code=422, detail="PagerDuty routing key가 필요합니다")
        return
    if provider == "email":
        if not request.email_host or not request.email_from or not request.email_recipients:
            raise HTTPException(status_code=422, detail="SMTP host, 발신자, 수신자 설정이 필요합니다")
        if request.email_username and not effective_email_password:
            raise HTTPException(status_code=422, detail="SMTP 비밀번호가 필요합니다")
        return
    if not request.webhook_url:
        raise HTTPException(status_code=422, detail="Webhook URL이 필요합니다")

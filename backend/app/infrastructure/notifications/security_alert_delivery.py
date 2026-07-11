from typing import Any

from app.infrastructure.notifications.security_alert_payloads import (
    build_discord_payload,
    build_pagerduty_payload,
    build_payload,
    build_slack_payload,
    build_teams_payload,
    build_telegram_message,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

PAGERDUTY_EVENTS_API_URL = "https://events.pagerduty.com/v2/enqueue"


async def build_alert_request(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[str, dict[str, Any]] | None:
    if provider == "telegram":
        bot_token = ((await repo.get("security_alert_telegram_bot_token")) or "").strip()
        chat_id = ((await repo.get("security_alert_telegram_chat_id")) or "").strip()
        if not bot_token or not chat_id:
            return None
        return (
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            {
                "chat_id": chat_id,
                "text": build_telegram_message(audit_log, event, category),
            },
        )
    if provider == "pagerduty":
        routing_key = ((await repo.get("security_alert_pagerduty_routing_key")) or "").strip()
        if not routing_key:
            return None
        return PAGERDUTY_EVENTS_API_URL, build_pagerduty_payload(audit_log, event, routing_key, category)

    webhook_url = ((await repo.get("security_alert_webhook_url")) or "").strip()
    if not webhook_url:
        return None

    if provider == "slack":
        return webhook_url, build_slack_payload(audit_log, event, category)
    if provider == "discord":
        return webhook_url, build_discord_payload(audit_log, event, category)
    if provider == "teams":
        return webhook_url, build_teams_payload(audit_log, event, category)
    return webhook_url, build_payload(audit_log, event, category)


async def post_alert_request(
    *,
    httpx_module,
    timeout_seconds: int,
    url: str,
    payload: dict[str, Any],
) -> None:
    async with httpx_module.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()

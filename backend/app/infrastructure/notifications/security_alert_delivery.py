import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging_config import redact_sensitive_log_value
from app.infrastructure.notifications.security_alert_email import (
    send_email_alert_with_detail,
)
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
logger = logging.getLogger(__name__)


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


async def deliver_alert(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[bool, str]:
    if provider == "email":
        return await send_email_alert_with_detail(repo, audit_log, event, category)

    request = await build_alert_request(repo, audit_log, event, provider, category)
    if request is None:
        return False, f"{provider} 채널 설정이 완전하지 않습니다"

    url, payload = request
    try:
        await post_alert_request(
            httpx_module=httpx,
            timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
            url=url,
            payload=payload,
        )
        return True, f"{provider} 채널로 전송했습니다"
    except httpx.HTTPError as exc:
        detail = format_http_error_detail(exc)
        logger.warning("보안 웹훅 알림 전송 실패: %s", detail, exc_info=True)
        return False, detail


def format_http_error_detail(exc: httpx.HTTPError) -> str:
    message = str(exc).strip()
    if not message:
        if isinstance(exc, httpx.TimeoutException):
            message = "요청 제한 시간 초과"
        elif isinstance(exc, httpx.ConnectError):
            message = "연결 실패"
        else:
            message = "전송 실패"

    error_name = exc.__class__.__name__
    detail = message if error_name in message else f"{error_name}: {message}"

    try:
        request = exc.request
    except RuntimeError:
        request = None

    if request is not None:
        detail = f"{detail} ({request.method} {request.url})"
    return redact_sensitive_log_value(detail)

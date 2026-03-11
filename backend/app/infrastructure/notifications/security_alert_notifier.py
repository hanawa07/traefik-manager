import logging
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)

SECURITY_ALERT_EVENTS = {"login_locked", "login_suspicious", "login_blocked_ip"}
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram"}


async def notify_if_needed(db: AsyncSession, audit_log: AuditLogModel) -> bool:
    event = _get_event(audit_log)
    if event not in SECURITY_ALERT_EVENTS:
        return False

    repo = SQLiteSystemSettingsRepository(db)
    enabled = await _get_bool_setting(repo, "security_alerts_enabled", default=False)
    provider = ((await repo.get("security_alert_provider")) or "generic").strip().lower()
    if provider not in SECURITY_ALERT_PROVIDERS:
        provider = "generic"

    if not enabled:
        return False

    request = await _build_request(repo, audit_log, event, provider)
    if request is None:
        return False

    url, payload = request
    try:
        async with httpx.AsyncClient(timeout=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS) as client:
            await client.post(url, json=payload)
        return True
    except httpx.HTTPError as exc:
        logger.warning("보안 웹훅 알림 전송 실패: %s", exc, exc_info=True)
        return False


async def _get_bool_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: bool,
) -> bool:
    value = await repo.get(key)
    if value is None:
        return default
    return value.strip().lower() == "true"


def _get_event(audit_log: AuditLogModel) -> str | None:
    detail = audit_log.detail or {}
    event = detail.get("event")
    return event if isinstance(event, str) else None


def _build_payload(audit_log: AuditLogModel, event: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    return {
        "source": "traefik-manager",
        "category": "security",
        "event": event,
        "actor": audit_log.actor,
        "resource_type": audit_log.resource_type,
        "resource_id": audit_log.resource_id,
        "resource_name": audit_log.resource_name,
        "client_ip": detail.get("client_ip"),
        "created_at": audit_log.created_at.isoformat(),
        "detail": detail,
        "message": _build_message(event, audit_log.resource_name, detail.get("client_ip")),
    }


async def _build_request(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
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
                "text": _build_telegram_message(audit_log, event),
            },
        )

    webhook_url = ((await repo.get("security_alert_webhook_url")) or "").strip()
    if not webhook_url:
        return None

    if provider == "slack":
        return webhook_url, _build_slack_payload(audit_log, event)
    if provider == "discord":
        return webhook_url, _build_discord_payload(audit_log, event)
    return webhook_url, _build_payload(audit_log, event)


def _build_message(event: str, resource_name: str, client_ip: Any) -> str:
    if event == "login_locked":
        return f"계정 잠금 감지: {resource_name}"
    if event == "login_suspicious":
        return f"이상 징후 로그인 감지: {client_ip or resource_name}"
    return f"이상 징후 IP 차단: {client_ip or resource_name}"


def _build_slack_payload(audit_log: AuditLogModel, event: str) -> dict[str, Any]:
    message = _build_message(event, audit_log.resource_name, (audit_log.detail or {}).get("client_ip"))
    return {
        "text": f"[Traefik Manager] {message}",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "Traefik Manager 보안 경고"},
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": _build_multiline_message(audit_log, event),
                },
            },
        ],
    }


def _build_discord_payload(audit_log: AuditLogModel, event: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    return {
        "content": f"[Traefik Manager] {_build_message(event, audit_log.resource_name, detail.get('client_ip'))}",
        "embeds": [
            {
                "title": "Traefik Manager 보안 경고",
                "description": _build_multiline_message(audit_log, event),
                "fields": [
                    {"name": "이벤트", "value": event, "inline": True},
                    {"name": "대상", "value": audit_log.resource_name or "-", "inline": True},
                    {"name": "IP", "value": str(detail.get("client_ip") or "-"), "inline": True},
                ],
            }
        ],
    }


def _build_telegram_message(audit_log: AuditLogModel, event: str) -> str:
    return _build_multiline_message(audit_log, event).replace("*", "")


def _build_multiline_message(audit_log: AuditLogModel, event: str) -> str:
    detail = audit_log.detail or {}
    return "\n".join(
        [
            _build_message(event, audit_log.resource_name, detail.get("client_ip")),
            f"이벤트: {event}",
            f"대상: {audit_log.resource_name or '-'}",
            f"IP: {detail.get('client_ip') or '-'}",
            f"시각: {audit_log.created_at.isoformat()}",
        ]
    )

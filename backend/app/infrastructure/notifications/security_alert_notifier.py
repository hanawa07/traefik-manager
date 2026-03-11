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


async def notify_if_needed(db: AsyncSession, audit_log: AuditLogModel) -> bool:
    event = _get_event(audit_log)
    if event not in SECURITY_ALERT_EVENTS:
        return False

    repo = SQLiteSystemSettingsRepository(db)
    enabled = await _get_bool_setting(repo, "security_alerts_enabled", default=False)
    webhook_url = (await repo.get("security_alert_webhook_url")) or ""
    if not enabled or not webhook_url:
        return False

    payload = _build_payload(audit_log, event)
    try:
        async with httpx.AsyncClient(timeout=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS) as client:
            await client.post(webhook_url, json=payload)
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


def _build_message(event: str, resource_name: str, client_ip: Any) -> str:
    if event == "login_locked":
        return f"계정 잠금 감지: {resource_name}"
    if event == "login_suspicious":
        return f"이상 징후 로그인 감지: {client_ip or resource_name}"
    return f"이상 징후 IP 차단: {client_ip or resource_name}"

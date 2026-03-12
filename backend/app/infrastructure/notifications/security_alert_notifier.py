import asyncio
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
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
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"}
SECURITY_ALERT_ROUTE_TARGETS = {"default", "disabled", "telegram", "pagerduty", "email"}
PAGERDUTY_EVENTS_API_URL = "https://events.pagerduty.com/v2/enqueue"


async def notify_if_needed(db: AsyncSession, audit_log: AuditLogModel) -> bool:
    event = _get_event(audit_log)
    if event not in SECURITY_ALERT_EVENTS:
        return False

    repo = SQLiteSystemSettingsRepository(db)
    enabled = await _get_bool_setting(repo, "security_alerts_enabled", default=False)
    if not enabled:
        return False

    provider = await _get_effective_provider(repo, event)
    if provider is None:
        return False

    if provider == "email":
        return await _send_email_alert(repo, audit_log, event)

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


async def send_test_alert(db: AsyncSession) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    provider = ((await repo.get("security_alert_provider")) or "generic").strip().lower()
    if provider not in SECURITY_ALERT_PROVIDERS:
        provider = "generic"

    audit_log = AuditLogModel(
        actor="system",
        action="test",
        resource_type="settings",
        resource_id="security-alerts",
        resource_name="security-alerts",
        detail={
            "event": "login_suspicious",
            "client_ip": "203.0.113.10",
            "test": True,
        },
    )
    audit_log.created_at = datetime.now(timezone.utc)

    if provider == "email":
        success = await _send_email_alert(repo, audit_log, "login_suspicious")
        return {
            "success": success,
            "provider": provider,
            "message": "테스트 보안 알림을 전송했습니다" if success else "테스트 보안 알림 전송에 실패했습니다",
            "detail": "현재 SMTP 설정으로 테스트 메시지를 전송했습니다" if success else "SMTP 설정을 다시 확인하세요",
        }

    request = await _build_request(repo, audit_log, "login_suspicious", provider)
    if request is None:
        return {
            "success": False,
            "provider": provider,
            "message": "테스트 보안 알림 전송에 실패했습니다",
            "detail": "현재 provider 설정이 완전하지 않습니다",
        }

    url, payload = request
    try:
        async with httpx.AsyncClient(timeout=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS) as client:
            await client.post(url, json=payload)
        return {
            "success": True,
            "provider": provider,
            "message": "테스트 보안 알림을 전송했습니다",
            "detail": f"{provider} 채널로 테스트 payload를 전송했습니다",
        }
    except httpx.HTTPError as exc:
        logger.warning("테스트 보안 웹훅 알림 전송 실패: %s", exc, exc_info=True)
        return {
            "success": False,
            "provider": provider,
            "message": "테스트 보안 알림 전송에 실패했습니다",
            "detail": str(exc),
        }


async def _send_email_alert(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
) -> bool:
    email_settings = await _build_email_settings(repo)
    if email_settings is None:
        return False

    try:
        await asyncio.to_thread(_send_email_sync, email_settings, audit_log, event)
        return True
    except OSError as exc:
        logger.warning("보안 이메일 알림 전송 실패: %s", exc, exc_info=True)
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


async def _get_effective_provider(repo: SQLiteSystemSettingsRepository, event: str) -> str | None:
    default_provider = ((await repo.get("security_alert_provider")) or "generic").strip().lower()
    if default_provider not in SECURITY_ALERT_PROVIDERS:
        default_provider = "generic"

    route_target = ((await repo.get(f"security_alert_route_{event}")) or "default").strip().lower()
    if route_target not in SECURITY_ALERT_ROUTE_TARGETS:
        route_target = "default"
    if route_target == "disabled":
        return None
    if route_target == "default":
        return default_provider
    return route_target


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


async def _build_email_settings(repo: SQLiteSystemSettingsRepository) -> dict[str, Any] | None:
    host = ((await repo.get("security_alert_email_host")) or "").strip()
    from_email = ((await repo.get("security_alert_email_from")) or "").strip()
    recipients_raw = ((await repo.get("security_alert_email_recipients")) or "").strip()
    if not host or not from_email or not recipients_raw:
        return None

    port_value = ((await repo.get("security_alert_email_port")) or "587").strip()
    security = ((await repo.get("security_alert_email_security")) or "starttls").strip().lower()
    username = ((await repo.get("security_alert_email_username")) or "").strip()
    password = ((await repo.get("security_alert_email_password")) or "").strip()
    recipients = [item.strip() for item in recipients_raw.replace(",", "\n").splitlines() if item.strip()]
    try:
        port = int(port_value)
    except ValueError:
        port = 587

    return {
        "host": host,
        "port": port,
        "security": security if security in {"none", "starttls", "ssl"} else "starttls",
        "username": username,
        "password": password,
        "from_email": from_email,
        "recipients": recipients,
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
    if provider == "pagerduty":
        routing_key = ((await repo.get("security_alert_pagerduty_routing_key")) or "").strip()
        if not routing_key:
            return None
        return PAGERDUTY_EVENTS_API_URL, _build_pagerduty_payload(audit_log, event, routing_key)

    webhook_url = ((await repo.get("security_alert_webhook_url")) or "").strip()
    if not webhook_url:
        return None

    if provider == "slack":
        return webhook_url, _build_slack_payload(audit_log, event)
    if provider == "discord":
        return webhook_url, _build_discord_payload(audit_log, event)
    if provider == "teams":
        return webhook_url, _build_teams_payload(audit_log, event)
    return webhook_url, _build_payload(audit_log, event)


def _build_message(event: str, resource_name: str, client_ip: Any) -> str:
    if event == "login_locked":
        return f"계정 잠금 감지: {resource_name}"
    if event == "login_suspicious":
        return f"이상 징후 로그인 감지: {client_ip or resource_name}"
    return f"이상 징후 IP 차단: {client_ip or resource_name}"


def _send_email_sync(email_settings: dict[str, Any], audit_log: AuditLogModel, event: str) -> None:
    message = EmailMessage()
    detail = audit_log.detail or {}
    message["Subject"] = f"[Traefik Manager] {_build_message(event, audit_log.resource_name, detail.get('client_ip'))}"
    message["From"] = email_settings["from_email"]
    message["To"] = ", ".join(email_settings["recipients"])
    message.set_content(_build_multiline_message(audit_log, event))

    timeout = settings.SECURITY_ALERT_EMAIL_TIMEOUT_SECONDS
    security = email_settings["security"]
    if security == "ssl":
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            email_settings["host"],
            email_settings["port"],
            timeout=timeout,
            context=ssl.create_default_context(),
        )
    else:
        client = smtplib.SMTP(
            email_settings["host"],
            email_settings["port"],
            timeout=timeout,
        )

    with client:
        if security == "starttls":
            client.starttls(context=ssl.create_default_context())
        if email_settings["username"] and email_settings["password"]:
            client.login(email_settings["username"], email_settings["password"])
        client.send_message(message)


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


def _build_teams_payload(audit_log: AuditLogModel, event: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "size": "Medium",
                            "weight": "Bolder",
                            "text": "Traefik Manager 보안 경고",
                        },
                        {
                            "type": "TextBlock",
                            "wrap": True,
                            "text": _build_message(event, audit_log.resource_name, detail.get("client_ip")),
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                {"title": "이벤트", "value": event},
                                {"title": "대상", "value": audit_log.resource_name or "-"},
                                {"title": "IP", "value": str(detail.get("client_ip") or "-")},
                                {"title": "시각", "value": audit_log.created_at.isoformat()},
                            ],
                        },
                    ],
                },
            }
        ],
    }


def _build_pagerduty_payload(audit_log: AuditLogModel, event: str, routing_key: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    source = str(detail.get("client_ip") or audit_log.resource_name or "traefik-manager")
    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": _build_message(event, audit_log.resource_name, detail.get("client_ip")),
            "source": source,
            "severity": _build_pagerduty_severity(event),
            "component": "traefik-manager",
            "group": "security",
            "class": event,
            "custom_details": _build_payload(audit_log, event),
        },
    }


def _build_pagerduty_severity(event: str) -> str:
    if event == "login_blocked_ip":
        return "critical"
    if event == "login_locked":
        return "error"
    return "warning"


def _build_telegram_message(audit_log: AuditLogModel, event: str) -> str:
    return _build_multiline_message(audit_log, event).replace("*", "")


def _build_multiline_message(audit_log: AuditLogModel, event: str) -> str:
    detail = audit_log.detail or {}
    lines = [
        _build_message(event, audit_log.resource_name, detail.get("client_ip")),
        f"이벤트: {event}",
        f"대상: {audit_log.resource_name or '-'}",
        f"IP: {detail.get('client_ip') or '-'}",
        f"시각: {audit_log.created_at.isoformat()}",
    ]
    if event == "login_blocked_ip":
        if detail.get("block_minutes") is not None:
            lines.append(f"차단 시간: {detail.get('block_minutes')}분")
        if detail.get("repeat_count") is not None:
            lines.append(f"반복 차단 횟수: {detail.get('repeat_count')}")
        if detail.get("blocked_until"):
            lines.append(f"차단 해제 시각: {detail.get('blocked_until')}")
    return "\n".join(lines)

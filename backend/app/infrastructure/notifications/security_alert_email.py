import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from app.core.config import settings
from app.infrastructure.notifications.security_alert_payloads import (
    build_message,
    build_multiline_message,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)


async def send_email_alert_with_detail(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    category: str,
) -> tuple[bool, str]:
    email_settings = await build_email_settings(repo)
    if email_settings is None:
        return False, "email 채널 설정이 완전하지 않습니다"

    try:
        await asyncio.to_thread(send_email_sync, email_settings, audit_log, event, category)
        return True, "email 채널로 전송했습니다"
    except OSError as exc:
        logger.warning("보안 이메일 알림 전송 실패: %s", exc, exc_info=True)
        return False, str(exc)


async def build_email_settings(repo: SQLiteSystemSettingsRepository) -> dict[str, Any] | None:
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


def send_email_sync(email_settings: dict[str, Any], audit_log: AuditLogModel, event: str, category: str) -> None:
    message = EmailMessage()
    detail = audit_log.detail or {}
    message["Subject"] = (
        f"[Traefik Manager] {build_message(event, audit_log.resource_name, detail.get('client_ip'), category)}"
    )
    message["From"] = email_settings["from_email"]
    message["To"] = ", ".join(email_settings["recipients"])
    message.set_content(build_multiline_message(audit_log, event, category))

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

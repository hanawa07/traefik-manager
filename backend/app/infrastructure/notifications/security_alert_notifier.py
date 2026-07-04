import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging_config import redact_sensitive_log_value
from app.infrastructure.notifications.security_alert_email import (
    send_email_alert_with_detail as _send_email_alert_with_detail_impl,
)
from app.infrastructure.notifications.security_alert_delivery_log import (
    get_event as _get_event,
    record_delivery_result as _record_delivery_result,
)
from app.infrastructure.notifications.security_alert_delivery import (
    build_alert_request as _build_alert_request,
    post_alert_request as _post_alert_request,
)
from app.infrastructure.notifications.security_alert_routes import (
    SECURITY_ALERT_PROVIDERS,
    get_alert_context as _get_alert_context,
)
from app.infrastructure.notifications.security_alert_retry import (
    build_retry_delivery_context as _build_retry_delivery_context,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

logger = logging.getLogger(__name__)


async def notify_if_needed(db: AsyncSession, audit_log: AuditLogModel) -> bool:
    event = _get_event(audit_log)
    if event is None:
        return False

    repo = SQLiteSystemSettingsRepository(db)
    alert_context = await _get_alert_context(repo, event)
    if alert_context is None:
        return False

    category, provider = alert_context
    success, delivery_detail = await _deliver_alert(repo, audit_log, event, provider, category)
    await _record_delivery_result(
        db=db,
        audit_log=audit_log,
        event=event,
        category=category,
        provider=provider,
        success=success,
        delivery_detail=delivery_detail,
    )
    return success


async def retry_delivery(db: AsyncSession, delivery_log: AuditLogModel) -> dict[str, Any]:
    retry_context = _build_retry_delivery_context(delivery_log)
    repo = SQLiteSystemSettingsRepository(db)
    success, delivery_detail = await _deliver_alert(
        repo,
        retry_context.source_log,
        retry_context.source_event,
        retry_context.provider,
        retry_context.category,
    )
    await _record_delivery_result(
        db=db,
        audit_log=retry_context.source_log,
        event=retry_context.source_event,
        category=retry_context.category,
        provider=retry_context.provider,
        success=success,
        delivery_detail=delivery_detail,
        extra_detail={
            "trigger": "manual_retry",
            "retry_of_audit_id": str(delivery_log.id),
        },
    )
    return {
        "success": success,
        "message": "알림 전송을 다시 시도했습니다" if success else "알림 전송 재시도에 실패했습니다",
        "detail": delivery_detail,
        "provider": retry_context.provider,
        "source_event": retry_context.source_event,
    }


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
        success = await _send_email_alert(repo, audit_log, "login_suspicious", "security")
        return {
            "success": success,
            "provider": provider,
            "message": "테스트 보안 알림을 전송했습니다" if success else "테스트 보안 알림 전송에 실패했습니다",
            "detail": "현재 SMTP 설정으로 테스트 메시지를 전송했습니다" if success else "SMTP 설정을 다시 확인하세요",
        }

    request = await _build_request(repo, audit_log, "login_suspicious", provider, "security")
    if request is None:
        return {
            "success": False,
            "provider": provider,
            "message": "테스트 보안 알림 전송에 실패했습니다",
            "detail": "현재 provider 설정이 완전하지 않습니다",
        }

    url, payload = request
    try:
        await _post_alert_request(
            httpx_module=httpx,
            timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
            url=url,
            payload=payload,
        )
        return {
            "success": True,
            "provider": provider,
            "message": "테스트 보안 알림을 전송했습니다",
            "detail": f"{provider} 채널로 테스트 payload를 전송했습니다",
        }
    except httpx.HTTPError as exc:
        detail = redact_sensitive_log_value(str(exc))
        logger.warning("테스트 보안 웹훅 알림 전송 실패: %s", exc, exc_info=True)
        return {
            "success": False,
            "provider": provider,
            "message": "테스트 보안 알림 전송에 실패했습니다",
            "detail": detail,
        }


async def _send_email_alert(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    category: str,
) -> bool:
    success, _detail = await _send_email_alert_with_detail(repo, audit_log, event, category)
    return success


async def _send_email_alert_with_detail(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    category: str,
) -> tuple[bool, str]:
    return await _send_email_alert_with_detail_impl(repo, audit_log, event, category)


async def _deliver_alert(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[bool, str]:
    if provider == "email":
        return await _send_email_alert_with_detail(repo, audit_log, event, category)

    request = await _build_request(repo, audit_log, event, provider, category)
    if request is None:
        return False, f"{provider} 채널 설정이 완전하지 않습니다"

    url, payload = request
    try:
        await _post_alert_request(
            httpx_module=httpx,
            timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
            url=url,
            payload=payload,
        )
        return True, f"{provider} 채널로 전송했습니다"
    except httpx.HTTPError as exc:
        detail = redact_sensitive_log_value(str(exc))
        logger.warning("보안 웹훅 알림 전송 실패: %s", exc, exc_info=True)
        return False, detail


async def _build_request(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[str, dict[str, Any]] | None:
    return await _build_alert_request(repo, audit_log, event, provider, category)

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
    detail = delivery_log.detail or {}
    delivery_event = _get_event(delivery_log)
    if delivery_event not in {"security_alert_delivery_failure", "change_alert_delivery_failure"}:
        raise ValueError("재시도할 수 없는 알림 전송 로그입니다")

    provider = detail.get("provider")
    source_event = detail.get("source_event")
    source_action = detail.get("source_action")
    source_resource_type = detail.get("source_resource_type")
    source_resource_id = detail.get("source_resource_id")
    source_resource_name = detail.get("source_resource_name")
    if not all(
        isinstance(value, str) and value
        for value in (provider, source_event, source_action, source_resource_type, source_resource_id, source_resource_name)
    ):
        raise ValueError("재시도에 필요한 원본 알림 정보가 부족합니다")

    category = "security" if delivery_event.startswith("security_") else "change"
    repo = SQLiteSystemSettingsRepository(db)
    source_log = AuditLogModel(
        actor="system",
        action=source_action,
        resource_type=source_resource_type,
        resource_id=source_resource_id,
        resource_name=source_resource_name,
        detail={
            "event": source_event,
            "client_ip": detail.get("client_ip"),
        },
    )
    source_log.created_at = datetime.now(timezone.utc)

    success, delivery_detail = await _deliver_alert(repo, source_log, source_event, provider, category)
    await _record_delivery_result(
        db=db,
        audit_log=source_log,
        event=source_event,
        category=category,
        provider=provider,
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
        "provider": provider,
        "source_event": source_event,
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
        logger.warning("보안 웹훅 알림 전송 실패: %s", exc, exc_info=True)
        return False, str(exc)


async def _build_request(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[str, dict[str, Any]] | None:
    return await _build_alert_request(repo, audit_log, event, provider, category)

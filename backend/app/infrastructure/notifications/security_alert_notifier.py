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
    if _is_routine_smoke_account_password_rotation(audit_log, event):
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


def _is_routine_smoke_account_password_rotation(audit_log: AuditLogModel, event: str) -> bool:
    detail = audit_log.detail or {}
    return (
        event == "user_update"
        and audit_log.resource_name in {
            settings.SMOKE_VIEWER_USERNAME,
            settings.SMOKE_ADMIN_USERNAME,
        }
        and detail.get("changed_keys") == ["password_changed"]
    )


async def retry_delivery(
    db: AsyncSession,
    delivery_log: AuditLogModel,
    *,
    trigger: str = "manual_retry",
) -> dict[str, Any]:
    if trigger not in {"manual_retry", "automatic_retry"}:
        raise ValueError("지원하지 않는 알림 재시도 방식입니다")
    retry_context = _build_retry_delivery_context(delivery_log)
    repo = SQLiteSystemSettingsRepository(db)
    success, delivery_detail = await _deliver_alert(
        repo,
        retry_context.source_log,
        retry_context.source_event,
        retry_context.provider,
        retry_context.category,
    )
    extra_detail = {
        "trigger": trigger,
        "retry_of_audit_id": str(delivery_log.id),
    }
    if trigger == "automatic_retry":
        detail = delivery_log.detail or {}
        extra_detail.update(
            {
                "auto_retry_attempt": int(detail.get("auto_retry_attempt") or 0) + 1,
                "retry_root_audit_id": detail.get("retry_root_audit_id")
                or detail.get("retry_of_audit_id")
                or str(delivery_log.id),
            }
        )
    await _record_delivery_result(
        db=db,
        audit_log=retry_context.source_log,
        event=retry_context.source_event,
        category=retry_context.category,
        provider=retry_context.provider,
        success=success,
        delivery_detail=delivery_detail,
        extra_detail=extra_detail,
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
        detail = _format_http_error_detail(exc)
        logger.warning("테스트 보안 웹훅 알림 전송 실패: %s", detail, exc_info=True)
        return {
            "success": False,
            "provider": provider,
            "message": "테스트 보안 알림 전송에 실패했습니다",
            "detail": detail,
        }


async def send_smoke_admin_stale_test_alert(db: AsyncSession) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    audit_log = AuditLogModel(
        actor="system",
        action="test",
        resource_type="settings",
        resource_id="smoke-admin-stale",
        resource_name="관리자 전용 운영 점검",
        detail={
            "event": "smoke_admin_stale_test",
            "test": True,
        },
    )
    audit_log.created_at = datetime.now(timezone.utc)
    success, detail = await _deliver_alert(
        repo,
        audit_log,
        "smoke_admin_stale_test",
        "telegram",
        "change",
    )
    return {
        "success": success,
        "provider": "telegram",
        "message": (
            "관리자 지연 알림 dry-run을 전송했습니다"
            if success
            else "관리자 지연 알림 dry-run 전송에 실패했습니다"
        ),
        "detail": detail,
    }


async def send_github_api_rate_limit_test_alert(db: AsyncSession) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    event = "github_api_rate_limit_test"
    alert_context = await _get_alert_context(repo, event)
    if alert_context is None:
        return {
            "success": False,
            "provider": None,
            "message": "GitHub API 반복 제한 dry-run을 전송하지 못했습니다",
            "detail": "운영 변경 알림과 Manager 상태 알림 경로를 확인하세요",
        }

    category, provider = alert_context
    audit_log = AuditLogModel(
        actor="system",
        action="test",
        resource_type="settings",
        resource_id="github-api-rate-limit-alert",
        resource_name="GitHub API 보조 요청 제한",
        detail={
            "event": event,
            "test": True,
            "alert_window_hours": 24,
            "alert_cooldown_hours": 24,
            "alert_threshold": 3,
            "window_occurrence_count": 3,
        },
    )
    audit_log.created_at = datetime.now(timezone.utc)
    success, detail = await _deliver_alert(repo, audit_log, event, provider, category)
    return {
        "success": success,
        "provider": provider,
        "message": (
            "GitHub API 반복 제한 dry-run을 전송했습니다"
            if success
            else "GitHub API 반복 제한 dry-run 전송에 실패했습니다"
        ),
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
        detail = _format_http_error_detail(exc)
        logger.warning("보안 웹훅 알림 전송 실패: %s", detail, exc_info=True)
        return False, detail


def _format_http_error_detail(exc: httpx.HTTPError) -> str:
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


async def _build_request(
    repo: SQLiteSystemSettingsRepository,
    audit_log: AuditLogModel,
    event: str,
    provider: str,
    category: str,
) -> tuple[str, dict[str, Any]] | None:
    return await _build_alert_request(repo, audit_log, event, provider, category)

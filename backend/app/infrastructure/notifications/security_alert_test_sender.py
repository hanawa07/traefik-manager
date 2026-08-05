from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.notifications.security_alert_delivery import deliver_alert
from app.infrastructure.notifications.security_alert_routes import (
    SECURITY_ALERT_PROVIDERS,
    get_alert_context,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)


async def send_test_alert(db: AsyncSession) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    provider = ((await repo.get("security_alert_provider")) or "generic").strip().lower()
    if provider not in SECURITY_ALERT_PROVIDERS:
        provider = "generic"

    success, delivery_detail = await deliver_alert(
        repo,
        _build_test_log(
            resource_id="security-alerts",
            resource_name="security-alerts",
            event="login_suspicious",
            detail={"client_ip": "203.0.113.10"},
        ),
        "login_suspicious",
        provider,
        "security",
    )
    if provider == "email":
        detail = (
            "현재 SMTP 설정으로 테스트 메시지를 전송했습니다"
            if success
            else "SMTP 설정을 다시 확인하세요"
        )
    elif success:
        detail = f"{provider} 채널로 테스트 payload를 전송했습니다"
    elif delivery_detail == f"{provider} 채널 설정이 완전하지 않습니다":
        detail = "현재 provider 설정이 완전하지 않습니다"
    else:
        detail = delivery_detail
    return {
        "success": success,
        "provider": provider,
        "message": "테스트 보안 알림을 전송했습니다" if success else "테스트 보안 알림 전송에 실패했습니다",
        "detail": detail,
    }


async def send_smoke_admin_stale_test_alert(db: AsyncSession) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    success, detail = await deliver_alert(
        repo,
        _build_test_log(
            resource_id="smoke-admin-stale",
            resource_name="관리자 전용 운영 점검",
            event="smoke_admin_stale_test",
        ),
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
    return await _send_manager_health_test_alert(
        db,
        event="github_api_rate_limit_test",
        label="GitHub API 반복 제한",
        resource_id="github-api-rate-limit-alert",
        resource_name="GitHub API 보조 요청 제한",
        detail={
            "alert_window_hours": 24,
            "alert_cooldown_hours": 24,
            "alert_threshold": 3,
            "window_occurrence_count": 3,
        },
    )


async def send_smoke_failure_type_increase_test_alert(db: AsyncSession) -> dict[str, Any]:
    return await _send_manager_health_test_alert(
        db,
        event="smoke_failure_type_increase_test",
        label="실패 유형 증가",
        resource_id="smoke-failure-type-increase-alert",
        resource_name="화면 회귀",
        detail={"window_days": 7, "recent_count": 3, "previous_count": 1},
    )


async def _send_manager_health_test_alert(
    db: AsyncSession,
    *,
    event: str,
    label: str,
    resource_id: str,
    resource_name: str,
    detail: dict[str, Any],
) -> dict[str, Any]:
    repo = SQLiteSystemSettingsRepository(db)
    alert_context = await get_alert_context(repo, event)
    if alert_context is None:
        return {
            "success": False,
            "provider": None,
            "message": f"{label} dry-run을 전송하지 못했습니다",
            "detail": "운영 변경 알림과 Manager 상태 알림 경로를 확인하세요",
        }

    category, provider = alert_context
    success, detail = await deliver_alert(
        repo,
        _build_test_log(
            resource_id=resource_id,
            resource_name=resource_name,
            event=event,
            detail=detail,
        ),
        event,
        provider,
        category,
    )
    return {
        "success": success,
        "provider": provider,
        "message": (
            f"{label} dry-run을 전송했습니다"
            if success
            else f"{label} dry-run 전송에 실패했습니다"
        ),
        "detail": detail,
    }


def _build_test_log(
    *,
    resource_id: str,
    resource_name: str,
    event: str,
    detail: dict[str, Any] | None = None,
) -> AuditLogModel:
    audit_log = AuditLogModel(
        actor="system",
        action="test",
        resource_type="settings",
        resource_id=resource_id,
        resource_name=resource_name,
        detail={"event": event, "test": True, **(detail or {})},
    )
    audit_log.created_at = datetime.now(timezone.utc)
    return audit_log

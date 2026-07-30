from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.infrastructure.notifications.security_alert_delivery_log import (
    get_event as _get_event,
    record_delivery_result as _record_delivery_result,
)
from app.infrastructure.notifications.security_alert_delivery import (
    deliver_alert as _deliver_alert,
)
from app.infrastructure.notifications.security_alert_routes import (
    get_alert_context as _get_alert_context,
)
from app.infrastructure.notifications.security_alert_retry import (
    build_retry_delivery_context as _build_retry_delivery_context,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

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

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.notifications.security_alert_payloads import build_message
from app.infrastructure.persistence.models import AuditLogModel


def get_event(audit_log: AuditLogModel) -> str | None:
    detail = audit_log.detail or {}
    event = detail.get("event")
    return event if isinstance(event, str) else None


async def record_delivery_result(
    *,
    db: AsyncSession,
    audit_log: AuditLogModel,
    event: str,
    category: str,
    provider: str,
    success: bool,
    delivery_detail: str | None,
    extra_detail: dict[str, Any] | None = None,
) -> None:
    if not callable(getattr(db, "add", None)) or not callable(getattr(db, "flush", None)):
        return

    detail = audit_log.detail or {}
    delivery_event = f"{category}_alert_delivery_{'success' if success else 'failure'}"
    delivery_log_detail = {
        "event": delivery_event,
        "success": success,
        "provider": provider,
        "message": build_message(event, audit_log.resource_name, detail.get("client_ip"), category),
        "detail": delivery_detail,
        "source_event": event,
        "source_action": audit_log.action,
        "source_resource_type": audit_log.resource_type,
        "source_resource_id": audit_log.resource_id,
        "source_resource_name": audit_log.resource_name,
        "client_ip": detail.get("client_ip"),
    }
    if extra_detail:
        delivery_log_detail.update(extra_detail)

    delivery_log = AuditLogModel(
        actor="system",
        action="alert",
        resource_type="settings",
        resource_id=f"{category}-alert-delivery",
        resource_name="보안 알림 전송 결과" if category == "security" else "운영 변경 알림 전송 결과",
        detail=delivery_log_detail,
    )
    delivery_log.created_at = datetime.now(timezone.utc)
    db.add(delivery_log)
    await db.flush()

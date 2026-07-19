from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.schemas.service_schemas import (
    BulkRoutingNotificationResponse,
)


async def complete_bulk_routing_notification_action(
    *,
    operation_id: UUID,
    db: AsyncSession,
) -> BulkRoutingNotificationResponse:
    operation_id_value = str(operation_id)
    event_column = AuditLogModel.detail["event"].as_string()
    operation_column = AuditLogModel.detail["bulk_operation_id"].as_string()
    result = await db.execute(
        select(AuditLogModel)
        .where(
            AuditLogModel.action == "update",
            AuditLogModel.resource_type == "service",
            event_column == "service_update",
            operation_column == operation_id_value,
        )
        .order_by(asc(AuditLogModel.created_at), asc(AuditLogModel.id))
    )
    logs = result.scalars().all()
    service_names = list(dict.fromkeys(log.resource_name for log in logs))
    if not service_names:
        return BulkRoutingNotificationResponse(
            operation_id=operation_id,
            service_count=0,
            notification_sent=False,
            already_processed=False,
        )

    delivery_result = await db.execute(
        select(AuditLogModel).where(
            AuditLogModel.action == "alert",
            AuditLogModel.detail["source_event"].as_string() == "service_update",
            AuditLogModel.detail["source_resource_id"].as_string()
            == operation_id_value,
            AuditLogModel.detail["source_resource_name"].as_string()
            == f"{len(service_names)}개 서비스",
        )
    )
    existing_delivery = delivery_result.scalars().first()
    if existing_delivery is not None:
        detail = existing_delivery.detail or {}
        return BulkRoutingNotificationResponse(
            operation_id=operation_id,
            service_count=len(service_names),
            notification_sent=detail.get("success") is True,
            already_processed=True,
        )

    summary_log = AuditLogModel(
        actor=logs[0].actor,
        action="update",
        resource_type="service",
        resource_id=operation_id_value,
        resource_name=f"{len(service_names)}개 서비스",
        detail={
            "event": "service_update",
            "bulk_operation_id": operation_id_value,
            "bulk_service_names": service_names,
            "changed_keys": ["routing_mode"],
        },
    )
    summary_log.created_at = datetime.now(timezone.utc)
    notification_sent = await security_alert_notifier.notify_if_needed(db, summary_log)
    return BulkRoutingNotificationResponse(
        operation_id=operation_id,
        service_count=len(service_names),
        notification_sent=notification_sent,
        already_processed=False,
    )

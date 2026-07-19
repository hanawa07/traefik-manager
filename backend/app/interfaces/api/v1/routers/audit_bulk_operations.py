from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditBulkOperationSummaryResponse,
)

router = APIRouter()


@router.get(
    "/bulk-operations",
    response_model=list[AuditBulkOperationSummaryResponse],
    summary="서비스 일괄 변경 작업 요약",
)
async def list_bulk_operations(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    operation_column = AuditLogModel.detail["bulk_operation_id"].as_string()
    event_column = AuditLogModel.detail["event"].as_string()
    operation_ids = await _load_recent_operation_ids(
        db,
        operation_column=operation_column,
        event_column=event_column,
        limit=limit,
    )
    if not operation_ids:
        return []

    service_result = await db.execute(
        select(AuditLogModel)
        .where(
            AuditLogModel.action == "update",
            AuditLogModel.resource_type == "service",
            event_column == "service_update",
            operation_column.in_(operation_ids),
        )
        .order_by(asc(AuditLogModel.created_at), asc(AuditLogModel.id))
    )
    delivery_result = await db.execute(
        select(AuditLogModel)
        .where(
            AuditLogModel.action == "alert",
            AuditLogModel.detail["source_event"].as_string() == "service_update",
            AuditLogModel.detail["source_resource_type"].as_string() == "service",
            AuditLogModel.detail["source_resource_id"].as_string().in_(operation_ids),
        )
        .order_by(desc(AuditLogModel.created_at), desc(AuditLogModel.id))
    )
    return _build_summaries(
        operation_ids,
        list(service_result.scalars().all()),
        list(delivery_result.scalars().all()),
    )


async def _load_recent_operation_ids(
    db: AsyncSession,
    *,
    operation_column,
    event_column,
    limit: int,
) -> list[str]:
    latest_at = func.max(AuditLogModel.created_at).label("latest_at")
    result = await db.execute(
        select(operation_column.label("operation_id"), latest_at)
        .where(
            AuditLogModel.action == "update",
            AuditLogModel.resource_type == "service",
            event_column == "service_update",
            operation_column.is_not(None),
        )
        .group_by(operation_column)
        .order_by(latest_at.desc())
        .limit(limit)
    )
    return [row.operation_id for row in result if isinstance(row.operation_id, str)]


def _build_summaries(
    operation_ids: list[str],
    service_logs: list[AuditLogModel],
    delivery_logs: list[AuditLogModel],
) -> list[AuditBulkOperationSummaryResponse]:
    grouped_services: dict[str, list[AuditLogModel]] = {item: [] for item in operation_ids}
    for log in service_logs:
        operation_id = (log.detail or {}).get("bulk_operation_id")
        if operation_id in grouped_services:
            grouped_services[operation_id].append(log)

    latest_delivery: dict[str, AuditLogModel] = {}
    for log in delivery_logs:
        operation_id = (log.detail or {}).get("source_resource_id")
        if operation_id in grouped_services and operation_id not in latest_delivery:
            latest_delivery[operation_id] = log

    summaries = []
    for operation_id in operation_ids:
        logs = grouped_services[operation_id]
        if not logs:
            continue
        service_names = list(dict.fromkeys(log.resource_name for log in logs))
        routing_modes = list(
            dict.fromkeys(
                mode
                for log in logs
                if (mode := _routing_mode_after(log)) is not None
            )
        )
        delivery = latest_delivery.get(operation_id)
        delivery_detail = (delivery.detail or {}) if delivery else {}
        success = delivery_detail.get("success")
        summaries.append(
            AuditBulkOperationSummaryResponse(
                operation_id=operation_id,
                actor=logs[0].actor,
                service_count=len(service_names),
                service_names=service_names,
                routing_mode_after=routing_modes[0] if len(routing_modes) == 1 else None,
                completed_at=logs[-1].created_at,
                notification_status=(
                    "success" if success is True else "failure" if success is False else "none"
                ),
                notification_provider=(
                    delivery_detail.get("provider")
                    if isinstance(delivery_detail.get("provider"), str)
                    else None
                ),
            )
        )
    return summaries


def _routing_mode_after(log: AuditLogModel) -> str | None:
    after = (log.detail or {}).get("after")
    if not isinstance(after, dict):
        return None
    routing_mode = after.get("routing_mode")
    return routing_mode if isinstance(routing_mode, str) else None

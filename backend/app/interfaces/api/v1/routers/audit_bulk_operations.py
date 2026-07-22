from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AUDIT_EVENT_EXPRESSION, AuditLogModel
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
    response: Response,
    limit: int = Query(5, ge=1, le=20),
    offset: int = Query(0, ge=0),
    period_days: int | None = Query(None, ge=1),
    notification_status: Literal["success", "failure", "none"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    if period_days is not None and period_days not in {7, 30, 90}:
        raise HTTPException(status_code=422, detail="기간은 7, 30, 90일 중 하나여야 합니다")
    operation_column = AuditLogModel.detail["bulk_operation_id"].as_string()
    event_column = AUDIT_EVENT_EXPRESSION
    cutoff = (
        datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=period_days)
        if period_days
        else None
    )
    all_operation_ids = await _load_recent_operation_ids(
        db,
        operation_column=operation_column,
        event_column=event_column,
        cutoff=cutoff,
    )
    if not all_operation_ids:
        response.headers["X-Total-Count"] = "0"
        return []
    operation_ids = (
        all_operation_ids
        if notification_status
        else all_operation_ids[offset : offset + limit]
    )

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
    summaries = _build_summaries(
        operation_ids,
        list(service_result.scalars().all()),
        list(delivery_result.scalars().all()),
    )
    if notification_status:
        summaries = [
            summary
            for summary in summaries
            if summary.notification_status == notification_status
        ]
        total_count = len(summaries)
        summaries = summaries[offset : offset + limit]
    else:
        total_count = len(all_operation_ids)
    response.headers["X-Total-Count"] = str(total_count)
    return summaries


async def _load_recent_operation_ids(
    db: AsyncSession,
    *,
    operation_column,
    event_column,
    cutoff: datetime | None,
) -> list[str]:
    latest_at = func.max(AuditLogModel.created_at).label("latest_at")
    query = (
        select(operation_column.label("operation_id"), latest_at)
        .where(
            AuditLogModel.action == "update",
            AuditLogModel.resource_type == "service",
            event_column == "service_update",
            operation_column.is_not(None),
        )
    )
    if cutoff:
        query = query.where(AuditLogModel.created_at >= cutoff)
    query = query.group_by(operation_column).order_by(latest_at.desc())
    result = await db.execute(query)
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

    deliveries_by_operation: dict[str, list[AuditLogModel]] = {
        item: [] for item in operation_ids
    }
    for log in delivery_logs:
        operation_id = (log.detail or {}).get("source_resource_id")
        if operation_id in deliveries_by_operation:
            deliveries_by_operation[operation_id].append(log)

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
        operation_deliveries = deliveries_by_operation[operation_id]
        delivery = operation_deliveries[0] if operation_deliveries else None
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
                notification_audit_id=delivery.id if delivery else None,
                notification_provider=(
                    delivery_detail.get("provider")
                    if isinstance(delivery_detail.get("provider"), str)
                    else None
                ),
                notification_attempt_count=len(operation_deliveries),
                last_failure_detail=_latest_failure_detail(operation_deliveries),
            )
        )
    return summaries


def _latest_failure_detail(deliveries: list[AuditLogModel]) -> str | None:
    for delivery in deliveries:
        detail = delivery.detail or {}
        failure_detail = detail.get("detail")
        if detail.get("success") is False and isinstance(failure_detail, str):
            failure_detail = failure_detail.strip()
            if failure_detail:
                return failure_detail
    return None


def _routing_mode_after(log: AuditLogModel) -> str | None:
    after = (log.detail or {}).get("after")
    if not isinstance(after, dict):
        return None
    routing_mode = after.get("routing_mode")
    return routing_mode if isinstance(routing_mode, str) else None

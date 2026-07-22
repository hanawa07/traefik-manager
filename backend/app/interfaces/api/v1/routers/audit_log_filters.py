from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from app.infrastructure.persistence.models import AUDIT_EVENT_EXPRESSION, AuditLogModel

SECURITY_EVENTS = {"login_failure", "login_locked", "login_suspicious", "login_blocked_ip"}
SMOKE_ROTATION_EVENTS = {"smoke_rotation_failed", "smoke_rotation_succeeded"}
GITHUB_API_RATE_LIMIT_EVENTS = {
    "github_api_primary_rate_limit",
    "github_api_secondary_rate_limit",
}
MANAGER_UNHEALTHY_EVENTS = {
    "manager_docker_unhealthy",
    "manager_http_errors_high",
    "manager_http_log_storage_warning",
    "manager_deployment_bottleneck_storage_warning",
    "manager_watchdog_stale",
}
MANAGER_RECOVERED_EVENTS = {
    "manager_docker_recovered",
    "manager_http_errors_recovered",
    "manager_http_log_storage_recovered",
    "manager_deployment_bottleneck_storage_recovered",
    "manager_watchdog_recovered",
}
MANAGER_SOURCE_EVENTS = {
    "docker": {"manager_docker_unhealthy", "manager_docker_recovered"},
    "api": {
        "manager_http_errors_high",
        "manager_http_errors_recovered",
        "manager_http_log_storage_warning",
        "manager_http_log_storage_recovered",
        "manager_deployment_bottleneck_storage_warning",
        "manager_deployment_bottleneck_storage_recovered",
    },
    "watchdog": {"manager_watchdog_stale", "manager_watchdog_recovered"},
}


def validate_audit_log_filters(
    *,
    period_days: int | None,
    start_date: date | None,
    end_date: date | None,
) -> None:
    if period_days is not None and period_days not in {1, 7, 30, 90}:
        raise HTTPException(status_code=422, detail="기간은 1, 7, 30, 90일 중 하나여야 합니다")
    if period_days and (start_date or end_date):
        raise HTTPException(status_code=422, detail="상대 기간과 사용자 지정 날짜는 함께 쓸 수 없습니다")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="시작일은 종료일보다 늦을 수 없습니다")


def build_audit_log_conditions(
    *,
    resource_type: str | None,
    action: str | None,
    event: str | None,
    manager_status: str | None,
    manager_source: str | None,
    period_days: int | None,
    start_date: date | None,
    end_date: date | None,
    search: str | None,
    security_only: bool,
    provider: str | None,
    delivery_success: bool | None,
    bulk_operation_id: str | None = None,
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    event_column = AUDIT_EVENT_EXPRESSION

    if start_date:
        conditions.append(AuditLogModel.created_at >= datetime.combine(start_date, time.min))
    elif period_days:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=period_days)
        conditions.append(AuditLogModel.created_at >= cutoff)
    if end_date:
        conditions.append(AuditLogModel.created_at <= datetime.combine(end_date, time.max))
    if resource_type:
        conditions.append(AuditLogModel.resource_type == resource_type)
    if security_only:
        conditions.append(event_column.in_(SECURITY_EVENTS))
    if action:
        conditions.append(AuditLogModel.action == action)
    if event:
        if event == "smoke_rotation_result":
            conditions.append(event_column.in_(SMOKE_ROTATION_EVENTS))
        elif event == "github_api_rate_limit":
            conditions.append(event_column.in_(GITHUB_API_RATE_LIMIT_EVENTS))
        else:
            conditions.append(event_column == event)
    if manager_status:
        manager_events = (
            MANAGER_UNHEALTHY_EVENTS if manager_status == "unhealthy" else MANAGER_RECOVERED_EVENTS
        )
        conditions.append(event_column.in_(manager_events))
    if manager_source:
        conditions.append(event_column.in_(MANAGER_SOURCE_EVENTS[manager_source]))
    if search_text := (search or "").strip():
        conditions.append(
            or_(
                AuditLogModel.id.icontains(search_text, autoescape=True),
                AuditLogModel.actor.icontains(search_text, autoescape=True),
                AuditLogModel.resource_name.icontains(search_text, autoescape=True),
                AuditLogModel.resource_id.icontains(search_text, autoescape=True),
            )
        )
    if provider:
        conditions.append(AuditLogModel.detail["provider"].as_string() == provider)
    if delivery_success is not None:
        conditions.append(AuditLogModel.detail["success"].as_boolean() == delivery_success)
    if bulk_operation_id:
        conditions.append(
            AuditLogModel.detail["bulk_operation_id"].as_string() == bulk_operation_id
        )
    return conditions

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from app.infrastructure.persistence.models import AuditLogModel

SECURITY_EVENTS = {"login_failure", "login_locked", "login_suspicious", "login_blocked_ip"}
MANAGER_UNHEALTHY_EVENTS = {"manager_docker_unhealthy", "manager_watchdog_stale"}
MANAGER_RECOVERED_EVENTS = {"manager_docker_recovered", "manager_watchdog_recovered"}
MANAGER_SOURCE_EVENTS = {
    "docker": {"manager_docker_unhealthy", "manager_docker_recovered"},
    "watchdog": {"manager_watchdog_stale", "manager_watchdog_recovered"},
}


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
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    event_column = AuditLogModel.detail["event"].as_string()

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
                AuditLogModel.actor.icontains(search_text, autoescape=True),
                AuditLogModel.resource_name.icontains(search_text, autoescape=True),
                AuditLogModel.resource_id.icontains(search_text, autoescape=True),
            )
        )
    if provider:
        conditions.append(AuditLogModel.detail["provider"].as_string() == provider)
    if delivery_success is not None:
        conditions.append(AuditLogModel.detail["success"].as_boolean() == delivery_success)
    return conditions

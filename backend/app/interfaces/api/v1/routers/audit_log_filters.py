from datetime import datetime, timedelta, timezone

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import (
    get_detail_bool,
    get_detail_str,
    get_event,
    normalize_utc,
)

SECURITY_EVENTS = {"login_failure", "login_locked", "login_suspicious", "login_blocked_ip"}
MANAGER_UNHEALTHY_EVENTS = {"manager_docker_unhealthy", "manager_watchdog_stale"}
MANAGER_RECOVERED_EVENTS = {"manager_docker_recovered", "manager_watchdog_recovered"}
MANAGER_SOURCE_EVENTS = {
    "docker": {"manager_docker_unhealthy", "manager_docker_recovered"},
    "watchdog": {"manager_watchdog_stale", "manager_watchdog_recovered"},
}


def filter_audit_logs(
    logs: list[AuditLogModel],
    *,
    resource_type: str | None,
    action: str | None,
    event: str | None,
    manager_status: str | None,
    manager_source: str | None,
    period_days: int | None,
    search: str | None,
    security_only: bool,
    provider: str | None,
    delivery_success: bool | None,
) -> list[AuditLogModel]:
    filtered = logs
    if period_days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
        filtered = [log for log in filtered if normalize_utc(log.created_at) >= cutoff]
    if resource_type:
        filtered = [log for log in filtered if log.resource_type == resource_type]
    if security_only:
        filtered = [log for log in filtered if get_event(log) in SECURITY_EVENTS]
    if action:
        filtered = [log for log in filtered if log.action == action]
    if event:
        filtered = [log for log in filtered if get_event(log) == event]
    if manager_status:
        manager_events = (
            MANAGER_UNHEALTHY_EVENTS if manager_status == "unhealthy" else MANAGER_RECOVERED_EVENTS
        )
        filtered = [log for log in filtered if get_event(log) in manager_events]
    if manager_source:
        filtered = [
            log for log in filtered if get_event(log) in MANAGER_SOURCE_EVENTS[manager_source]
        ]
    if search_text := (search or "").strip().casefold():
        filtered = [
            log
            for log in filtered
            if any(
                search_text in str(value or "").casefold()
                for value in (log.actor, log.resource_name, log.resource_id)
            )
        ]
    if provider:
        filtered = [log for log in filtered if get_detail_str(log, "provider") == provider]
    if delivery_success is not None:
        filtered = [log for log in filtered if get_detail_bool(log, "success") is delivery_success]
    return filtered

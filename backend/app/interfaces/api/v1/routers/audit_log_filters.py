from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import (
    get_detail_bool,
    get_detail_str,
    get_event,
)

SECURITY_EVENTS = {"login_failure", "login_locked", "login_suspicious", "login_blocked_ip"}
MANAGER_UNHEALTHY_EVENTS = {"manager_docker_unhealthy", "manager_watchdog_stale"}
MANAGER_RECOVERED_EVENTS = {"manager_docker_recovered", "manager_watchdog_recovered"}


def filter_audit_logs(
    logs: list[AuditLogModel],
    *,
    resource_type: str | None,
    action: str | None,
    event: str | None,
    manager_status: str | None,
    security_only: bool,
    provider: str | None,
    delivery_success: bool | None,
) -> list[AuditLogModel]:
    filtered = logs
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
    if provider:
        filtered = [log for log in filtered if get_detail_str(log, "provider") == provider]
    if delivery_success is not None:
        filtered = [log for log in filtered if get_detail_bool(log, "success") is delivery_success]
    return filtered

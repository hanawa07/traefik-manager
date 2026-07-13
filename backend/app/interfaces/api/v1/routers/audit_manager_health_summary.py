from datetime import datetime, timedelta

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_filters import (
    MANAGER_RECOVERED_EVENTS,
    MANAGER_UNHEALTHY_EVENTS,
)
from app.interfaces.api.v1.routers.audit_log_helpers import get_event, normalize_utc
from app.interfaces.api.v1.schemas.audit_schemas import AuditManagerHealthSummaryResponse


def build_manager_health_summary(
    *,
    logs: list[AuditLogModel],
    window_minutes: int,
    now: datetime,
) -> AuditManagerHealthSummaryResponse:
    cutoff = normalize_utc(now) - timedelta(minutes=window_minutes)
    events = [
        get_event(log)
        for log in logs
        if normalize_utc(log.created_at) >= cutoff
    ]
    return AuditManagerHealthSummaryResponse(
        window_minutes=window_minutes,
        unhealthy_count=sum(event in MANAGER_UNHEALTHY_EVENTS for event in events),
        recovered_count=sum(event in MANAGER_RECOVERED_EVENTS for event in events),
        docker_unhealthy_count=events.count("manager_docker_unhealthy"),
        docker_recovered_count=events.count("manager_docker_recovered"),
        api_unhealthy_count=events.count("manager_http_errors_high"),
        api_recovered_count=events.count("manager_http_errors_recovered"),
        watchdog_unhealthy_count=events.count("manager_watchdog_stale"),
        watchdog_recovered_count=events.count("manager_watchdog_recovered"),
    )

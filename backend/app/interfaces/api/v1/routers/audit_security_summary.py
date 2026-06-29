from datetime import datetime, timedelta

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import get_event, normalize_utc
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditSecurityEventResponse,
    AuditSecuritySummaryResponse,
)

SECURITY_ALERT_EVENTS = {"login_locked", "login_suspicious", "login_blocked_ip"}


def build_security_summary(
    *,
    logs: list[AuditLogModel],
    window_minutes: int,
    recent_limit: int,
    now: datetime,
) -> AuditSecuritySummaryResponse:
    cutoff = normalize_utc(now) - timedelta(minutes=window_minutes)
    recent_logs = sorted(
        [log for log in logs if normalize_utc(log.created_at) >= cutoff],
        key=lambda log: normalize_utc(log.created_at),
        reverse=True,
    )

    failed_logs = [log for log in recent_logs if get_event(log) == "login_failure"]
    locked_logs = [log for log in recent_logs if get_event(log) == "login_locked"]
    suspicious_logs = [log for log in recent_logs if get_event(log) == "login_suspicious"]
    blocked_logs = [log for log in recent_logs if get_event(log) == "login_blocked_ip"]

    return AuditSecuritySummaryResponse(
        window_minutes=window_minutes,
        failed_login_count=len(failed_logs),
        locked_login_count=len(locked_logs),
        suspicious_ip_count=len(suspicious_logs),
        blocked_ip_count=len(blocked_logs),
        recent_events=[
            AuditSecurityEventResponse(
                id=log.id,
                event=get_event(log) or "unknown",
                actor=log.actor,
                resource_name=log.resource_name,
                client_ip=(log.detail or {}).get("client_ip"),
                created_at=normalize_utc(log.created_at),
            )
            for log in recent_logs
            if get_event(log) in SECURITY_ALERT_EVENTS
        ][:recent_limit],
    )

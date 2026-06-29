from datetime import datetime, timedelta

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_helpers import (
    get_detail_int,
    get_detail_str,
    get_event,
    normalize_utc,
)
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditCertificateEventResponse,
    AuditCertificateSummaryResponse,
)

CERTIFICATE_ALERT_EVENTS = {"certificate_warning", "certificate_error", "certificate_recovered"}


def build_certificate_summary(
    *,
    logs: list[AuditLogModel],
    window_minutes: int,
    recent_limit: int,
    now: datetime,
) -> AuditCertificateSummaryResponse:
    cutoff = normalize_utc(now) - timedelta(minutes=window_minutes)
    recent_logs = sorted(
        [
            log
            for log in logs
            if normalize_utc(log.created_at) >= cutoff and get_event(log) in CERTIFICATE_ALERT_EVENTS
        ],
        key=lambda log: normalize_utc(log.created_at),
        reverse=True,
    )

    warning_logs = [log for log in recent_logs if get_event(log) == "certificate_warning"]
    error_logs = [log for log in recent_logs if get_event(log) == "certificate_error"]
    recovered_logs = [log for log in recent_logs if get_event(log) == "certificate_recovered"]

    return AuditCertificateSummaryResponse(
        window_minutes=window_minutes,
        warning_count=len(warning_logs),
        error_count=len(error_logs),
        recovered_count=len(recovered_logs),
        recent_events=[
            AuditCertificateEventResponse(
                id=log.id,
                event=get_event(log) or "unknown",
                actor=log.actor,
                resource_name=log.resource_name,
                days_remaining=get_detail_int(log, "days_remaining"),
                expires_at=get_detail_str(log, "expires_at"),
                previous_status=get_detail_str(log, "previous_status"),
                checked_at=get_detail_str(log, "checked_at"),
                created_at=normalize_utc(log.created_at),
            )
            for log in recent_logs[:recent_limit]
        ],
    )

from datetime import datetime, timedelta, timezone

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.schemas.settings_schemas import SettingsTestHistoryItemResponse


def find_latest_settings_test_event(
    logs: list[AuditLogModel],
    event_name: str,
) -> SettingsTestHistoryItemResponse:
    return find_latest_settings_events(logs, {event_name})


def find_latest_settings_events(
    logs: list[AuditLogModel],
    event_names: set[str],
) -> SettingsTestHistoryItemResponse:
    latest: SettingsTestHistoryItemResponse | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count = 0
    failure_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    for log in logs:
        detail = log.detail or {}
        event_name = detail.get("event")
        if not isinstance(event_name, str) or event_name not in event_names:
            continue
        success = detail.get("success")
        created_at = normalize_utc(log.created_at)
        if latest is None:
            latest = SettingsTestHistoryItemResponse(
                last_event=event_name,
                last_success=success if isinstance(success, bool) else None,
                last_message=detail.get("message") if isinstance(detail.get("message"), str) else None,
                last_detail=detail.get("detail") if isinstance(detail.get("detail"), str) else None,
                last_provider=detail.get("provider") if isinstance(detail.get("provider"), str) else None,
                last_created_at=created_at,
            )

        if isinstance(success, bool) and success and last_success_at is None:
            last_success_at = created_at

        if isinstance(success, bool) and not success:
            if last_failure_at is None:
                last_failure_at = created_at
                last_failure_audit_id = str(log.id)
                last_failure_message = detail.get("message") if isinstance(detail.get("message"), str) else None
                last_failure_detail = detail.get("detail") if isinstance(detail.get("detail"), str) else None
                last_failure_provider = detail.get("provider") if isinstance(detail.get("provider"), str) else None
            if created_at >= failure_cutoff:
                recent_failure_count += 1

    if latest is None:
        return SettingsTestHistoryItemResponse()

    latest.last_success_at = last_success_at
    latest.last_failure_at = last_failure_at
    latest.last_failure_audit_id = last_failure_audit_id
    latest.last_failure_message = last_failure_message
    latest.last_failure_detail = last_failure_detail
    latest.last_failure_provider = last_failure_provider
    latest.recent_failure_count = recent_failure_count
    return latest


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

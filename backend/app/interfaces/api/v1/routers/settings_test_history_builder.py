from datetime import datetime, timedelta, timezone

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_log_filters import GITHUB_API_RATE_LIMIT_EVENTS
from app.interfaces.api.v1.routers.settings_events import SETTINGS_DELIVERY_EVENTS, SETTINGS_TEST_EVENTS
from app.interfaces.api.v1.routers.settings_time_helpers import normalize_utc
from app.interfaces.api.v1.schemas.settings_schemas import (
    SettingsTestHistoryEventResponse,
    SettingsTestHistoryItemResponse,
    SettingsTestHistoryResponse,
)


def build_settings_test_history_response(logs: list[AuditLogModel]) -> SettingsTestHistoryResponse:
    cloudflare = find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare"])
    cloudflare_drift = find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare_drift"])
    cloudflare_reconcile = find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare_reconcile"])
    security_alert = find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["security_alert"])
    smoke_admin_stale = find_latest_settings_test_event(
        logs,
        SETTINGS_TEST_EVENTS["smoke_admin_stale"],
    )
    github_api_rate_limit = find_latest_settings_test_event(
        logs,
        SETTINGS_TEST_EVENTS["github_api_rate_limit"],
    )
    security_alert_delivery = find_latest_settings_events(logs, SETTINGS_DELIVERY_EVENTS["security_alert_delivery"])
    change_alert_delivery = find_latest_settings_events(logs, SETTINGS_DELIVERY_EVENTS["change_alert_delivery"])
    github_api_rate_limit_delivery = find_latest_settings_events(
        logs,
        SETTINGS_DELIVERY_EVENTS["change_alert_delivery"],
        source_events=GITHUB_API_RATE_LIMIT_EVENTS,
    )
    primary_event = "github_api_primary_rate_limit"
    secondary_event = "github_api_secondary_rate_limit"
    return SettingsTestHistoryResponse(
        cloudflare=cloudflare,
        cloudflare_drift=cloudflare_drift,
        cloudflare_reconcile=cloudflare_reconcile,
        security_alert=security_alert,
        smoke_admin_stale=smoke_admin_stale,
        github_api_rate_limit=github_api_rate_limit,
        security_alert_delivery=security_alert_delivery,
        change_alert_delivery=change_alert_delivery,
        github_api_rate_limit_delivery=github_api_rate_limit_delivery,
        github_api_rate_limit_last_triggered_at=find_latest_github_api_rate_limit_trigger(logs),
        github_api_primary_rate_limit_delivery=find_latest_settings_events(
            logs,
            SETTINGS_DELIVERY_EVENTS["change_alert_delivery"],
            source_events={primary_event},
        ),
        github_api_secondary_rate_limit_delivery=find_latest_settings_events(
            logs,
            SETTINGS_DELIVERY_EVENTS["change_alert_delivery"],
            source_events={secondary_event},
        ),
        github_api_primary_rate_limit_last_triggered_at=find_latest_github_api_rate_limit_trigger(
            logs,
            primary_event,
        ),
        github_api_secondary_rate_limit_last_triggered_at=find_latest_github_api_rate_limit_trigger(
            logs,
            secondary_event,
        ),
    )


def find_latest_settings_test_event(
    logs: list[AuditLogModel],
    event_name: str,
) -> SettingsTestHistoryItemResponse:
    return find_latest_settings_events(logs, {event_name})


def find_latest_settings_events(
    logs: list[AuditLogModel],
    event_names: set[str],
    *,
    source_events: set[str] | None = None,
) -> SettingsTestHistoryItemResponse:
    latest: SettingsTestHistoryItemResponse | None = None
    last_success_at: datetime | None = None
    last_success_provider: str | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count = 0
    recent_events: list[SettingsTestHistoryEventResponse] = []
    failure_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    for log in logs:
        detail = log.detail or {}
        event_name = detail.get("event")
        if not isinstance(event_name, str) or event_name not in event_names:
            continue
        if source_events is not None and detail.get("source_event") not in source_events:
            continue
        success = detail.get("success")
        created_at = normalize_utc(log.created_at)
        if len(recent_events) < 5:
            recent_events.append(
                SettingsTestHistoryEventResponse(
                    audit_id=str(log.id),
                    retry_of_audit_id=(
                        detail.get("retry_of_audit_id")
                        if isinstance(detail.get("retry_of_audit_id"), str)
                        else None
                    ),
                    success=success if isinstance(success, bool) else None,
                    message=detail.get("message") if isinstance(detail.get("message"), str) else None,
                    detail=detail.get("detail") if isinstance(detail.get("detail"), str) else None,
                    provider=detail.get("provider") if isinstance(detail.get("provider"), str) else None,
                    created_at=created_at,
                )
            )
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
            last_success_provider = (
                detail.get("provider") if isinstance(detail.get("provider"), str) else None
            )

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
    latest.last_success_provider = last_success_provider
    latest.last_failure_at = last_failure_at
    latest.last_failure_audit_id = last_failure_audit_id
    latest.last_failure_message = last_failure_message
    latest.last_failure_detail = last_failure_detail
    latest.last_failure_provider = last_failure_provider
    latest.recent_failure_count = recent_failure_count
    latest.recent_events = recent_events
    return latest


def find_latest_github_api_rate_limit_trigger(
    logs: list[AuditLogModel],
    event_name: str | None = None,
) -> datetime | None:
    for log in logs:
        detail = log.detail or {}
        if (
            detail.get("event") in GITHUB_API_RATE_LIMIT_EVENTS
            and (event_name is None or detail.get("event") == event_name)
            and detail.get("alert_triggered") is True
        ):
            return normalize_utc(log.created_at)
    return None

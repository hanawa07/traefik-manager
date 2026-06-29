from datetime import datetime, timedelta, timezone

from app.interfaces.api.v1.routers.settings_audit_helpers import find_latest_settings_events, normalize_utc
from tests.interfaces.api.settings_history_router_fakes import make_settings_history_log


def test_find_latest_settings_events_tracks_latest_failure_and_recent_count():
    now = datetime.now(timezone.utc)
    logs = [
        make_settings_history_log(
            log_id="latest-failure",
            event="security_alert_delivery_failure",
            detail={"success": False, "message": "latest", "detail": "network", "provider": "slack"},
            created_at=now - timedelta(minutes=5),
        ),
        make_settings_history_log(
            log_id="success",
            event="security_alert_delivery_success",
            detail={"success": True, "message": "ok", "provider": "slack"},
            created_at=now - timedelta(minutes=10),
        ),
        make_settings_history_log(
            log_id="old-failure",
            event="security_alert_delivery_failure",
            detail={"success": False, "message": "old", "provider": "slack"},
            created_at=now - timedelta(days=2),
        ),
    ]

    result = find_latest_settings_events(
        logs,
        {"security_alert_delivery_failure", "security_alert_delivery_success"},
    )

    assert result.last_event == "security_alert_delivery_failure"
    assert result.last_success is False
    assert result.last_failure_audit_id == "latest-failure"
    assert result.last_failure_message == "latest"
    assert result.last_success_at == now - timedelta(minutes=10)
    assert result.recent_failure_count == 1


def test_normalize_utc_accepts_naive_datetime():
    normalized = normalize_utc(datetime(2026, 6, 29, 12, 0, 0))

    assert normalized.tzinfo is not None
    assert normalized.utcoffset() == timedelta(0)

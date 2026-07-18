from datetime import datetime, timedelta, timezone

from app.interfaces.api.v1.routers.settings_audit_helpers import (
    build_settings_test_history_response,
    find_latest_settings_events,
    normalize_utc,
)
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


def test_settings_history_separates_smoke_admin_stale_dry_run():
    now = datetime.now(timezone.utc)
    result = build_settings_test_history_response(
        [
            make_settings_history_log(
                log_id="smoke-stale",
                event="settings_test_smoke_admin_stale",
                detail={"success": True, "provider": "telegram"},
                created_at=now,
            ),
            make_settings_history_log(
                log_id="security-alert",
                event="settings_test_security_alert",
                detail={"success": False, "provider": "slack"},
                created_at=now - timedelta(minutes=1),
            ),
        ]
    )

    assert result.smoke_admin_stale.last_success is True
    assert result.smoke_admin_stale.last_provider == "telegram"
    assert result.smoke_admin_stale.recent_events[0].audit_id == "smoke-stale"
    assert result.security_alert.last_success is False


def test_settings_history_keeps_five_recent_events_in_order():
    now = datetime.now(timezone.utc)
    logs = [
        make_settings_history_log(
            log_id=f"dry-run-{index}",
            event="settings_test_smoke_admin_stale",
            detail={
                "success": index % 2 == 0,
                "message": f"result-{index}",
                "detail": f"detail-{index}",
                "provider": "telegram",
            },
            created_at=now - timedelta(minutes=index),
        )
        for index in range(7)
    ]

    result = build_settings_test_history_response(logs).smoke_admin_stale

    assert [event.audit_id for event in result.recent_events] == [
        "dry-run-0",
        "dry-run-1",
        "dry-run-2",
        "dry-run-3",
        "dry-run-4",
    ]
    assert result.recent_events[0].message == "result-0"
    assert result.recent_events[0].detail == "detail-0"

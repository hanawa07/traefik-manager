import os
from datetime import datetime, timedelta, timezone

from app.core.manager_watchdog_state import read_manager_watchdog_state


def test_read_manager_watchdog_state_uses_status_and_file_mtime(tmp_path) -> None:
    state_path = tmp_path / "manager-health-watchdog.state"
    state_path.write_text(
        "status=healthy\nalert_active=0\nlast_alert_at=0\nconsecutive_failures=3\n"
        "last_dispatch_event=recovery\nlast_dispatch_success=1\nlast_dispatch_at=1783913580\n"
        "last_dispatch_run_url=https://github.com/hanawa07/traefik-manager/actions/runs/123\n"
        "dispatch_history=recovery|1783913580|https://github.com/hanawa07/traefik-manager/actions/runs/123,"
        "failure|1783910000|https://github.com/hanawa07/traefik-manager/actions/runs/122\n",
        encoding="utf-8",
    )
    checked_at = datetime(2026, 7, 13, 3, 35, tzinfo=timezone.utc)
    os.utime(state_path, (checked_at.timestamp(), checked_at.timestamp()))

    state = read_manager_watchdog_state(
        str(state_path),
        now=checked_at + timedelta(minutes=5),
    )

    assert state == {
        "external_watchdog_status": "healthy",
        "external_watchdog_checked_at": checked_at,
        "external_watchdog_consecutive_failures": 3,
        "external_watchdog_stale": False,
        "external_watchdog_stale_after_minutes": 10,
        "external_watchdog_last_alert_event": "recovery",
        "external_watchdog_last_alert_success": True,
        "external_watchdog_last_alert_at": datetime.fromtimestamp(1783913580, timezone.utc),
        "external_watchdog_last_alert_run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/123",
        "external_watchdog_alert_runs": [
            {
                "event": "recovery",
                "requested_at": datetime.fromtimestamp(1783913580, timezone.utc),
                "run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/123",
            },
            {
                "event": "failure",
                "requested_at": datetime.fromtimestamp(1783910000, timezone.utc),
                "run_url": "https://github.com/hanawa07/traefik-manager/actions/runs/122",
            },
        ],
    }


def test_read_manager_watchdog_state_handles_missing_file(tmp_path) -> None:
    state = read_manager_watchdog_state(str(tmp_path / "missing.state"))

    assert state == {
        "external_watchdog_status": "unknown",
        "external_watchdog_checked_at": None,
        "external_watchdog_consecutive_failures": 0,
        "external_watchdog_stale": False,
        "external_watchdog_stale_after_minutes": 10,
        "external_watchdog_last_alert_event": None,
        "external_watchdog_last_alert_success": None,
        "external_watchdog_last_alert_at": None,
        "external_watchdog_last_alert_run_url": None,
        "external_watchdog_alert_runs": [],
    }


def test_read_manager_watchdog_state_promotes_legacy_last_run(tmp_path) -> None:
    state_path = tmp_path / "manager-health-watchdog.state"
    state_path.write_text(
        "status=unhealthy\nlast_dispatch_event=failure\nlast_dispatch_success=1\n"
        "last_dispatch_at=1783913580\n"
        "last_dispatch_run_url=https://github.com/owner/repository/actions/runs/123\n",
        encoding="utf-8",
    )

    state = read_manager_watchdog_state(str(state_path))

    assert state["external_watchdog_alert_runs"] == [
        {
            "event": "failure",
            "requested_at": datetime.fromtimestamp(1783913580, timezone.utc),
            "run_url": "https://github.com/owner/repository/actions/runs/123",
        }
    ]


def test_read_manager_watchdog_state_marks_configured_delay(tmp_path) -> None:
    state_path = tmp_path / "manager-health-watchdog.state"
    state_path.write_text("status=healthy\n", encoding="utf-8")
    checked_at = datetime(2026, 7, 13, 3, 35, tzinfo=timezone.utc)
    os.utime(state_path, (checked_at.timestamp(), checked_at.timestamp()))

    state = read_manager_watchdog_state(
        str(state_path),
        now=checked_at + timedelta(minutes=15),
        stale_after_minutes=15,
    )

    assert state["external_watchdog_stale"] is True
    assert state["external_watchdog_stale_after_minutes"] == 15

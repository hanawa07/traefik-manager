import os
from datetime import datetime, timedelta, timezone

from app.core.manager_watchdog_state import read_manager_watchdog_state


def test_read_manager_watchdog_state_uses_status_and_file_mtime(tmp_path) -> None:
    state_path = tmp_path / "manager-health-watchdog.state"
    state_path.write_text(
        "status=healthy\nalert_active=0\nlast_alert_at=0\nconsecutive_failures=3\n",
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
    }


def test_read_manager_watchdog_state_handles_missing_file(tmp_path) -> None:
    state = read_manager_watchdog_state(str(tmp_path / "missing.state"))

    assert state == {
        "external_watchdog_status": "unknown",
        "external_watchdog_checked_at": None,
        "external_watchdog_consecutive_failures": 0,
        "external_watchdog_stale": False,
    }


def test_read_manager_watchdog_state_marks_ten_minute_delay(tmp_path) -> None:
    state_path = tmp_path / "manager-health-watchdog.state"
    state_path.write_text("status=healthy\n", encoding="utf-8")
    checked_at = datetime(2026, 7, 13, 3, 35, tzinfo=timezone.utc)
    os.utime(state_path, (checked_at.timestamp(), checked_at.timestamp()))

    state = read_manager_watchdog_state(
        str(state_path),
        now=checked_at + timedelta(minutes=10),
    )

    assert state["external_watchdog_stale"] is True

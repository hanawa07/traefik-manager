from datetime import datetime, timedelta, timezone

import pytest

from app.core.user_systemd_watchdog_state import read_user_systemd_watchdog_state
from app.interfaces.api.v1.schemas.manager_deployment_schemas import (
    UserSystemdWatchdogResponse,
)


CHECKED_AT = datetime(2026, 8, 27, 13, 42, 52, tzinfo=timezone.utc)


def test_reads_healthy_user_systemd_state(tmp_path) -> None:
    state_path = tmp_path / "user-systemd-unit-watchdog.state"
    state_path.write_text(
        "status=healthy\nalert_active=0\nconsecutive_failures=0\n"
        f"last_check_at={int(CHECKED_AT.timestamp())}\ndetail=ok:34-units\n",
        encoding="utf-8",
    )

    state = read_user_systemd_watchdog_state(
        str(state_path), now=CHECKED_AT + timedelta(minutes=5)
    )

    assert state == {
        "status": "healthy",
        "checked_at": CHECKED_AT,
        "stale": False,
        "stale_after_minutes": 20,
        "alert_active": False,
        "consecutive_failures": 0,
        "monitored_unit_count": 34,
        "issues": [],
    }


def test_reads_only_safe_issue_codes_and_unit_names(tmp_path) -> None:
    state_path = tmp_path / "user-systemd-unit-watchdog.state"
    state_path.write_text(
        "status=unhealthy\nalert_active=1\nconsecutive_failures=2\n"
        f"last_check_at={int(CHECKED_AT.timestamp())}\n"
        "detail=timer-disabled:sample.timer,service-failed:sample.service,"
        "unit-drift:../../private.service,baseline-invalid,unknown:secret.service\n",
        encoding="utf-8",
    )

    state = read_user_systemd_watchdog_state(
        str(state_path), now=CHECKED_AT + timedelta(minutes=10)
    )

    assert state["status"] == "unhealthy"
    assert state["stale"] is False
    assert state["alert_active"] is True
    assert state["consecutive_failures"] == 2
    assert state["monitored_unit_count"] == 0
    assert state["issues"] == [
        {"code": "timer-disabled", "unit": "sample.timer"},
        {"code": "service-failed", "unit": "sample.service"},
        {"code": "baseline-invalid", "unit": None},
    ]


@pytest.mark.parametrize("status", ["healthy", "unhealthy"])
@pytest.mark.parametrize(
    ("age_seconds", "stale"),
    [(600, False), (900, False), (1020, False), (1199, False), (1200, True), (1201, True)],
)
def test_stale_boundary_allows_timer_interval_and_execution_margin(
    tmp_path, status, age_seconds, stale
) -> None:
    state_path = tmp_path / "watchdog.state"
    state_path.write_text(
        f"status={status}\nlast_check_at={int(CHECKED_AT.timestamp())}\n",
        encoding="utf-8",
    )

    state = read_user_systemd_watchdog_state(
        str(state_path), now=CHECKED_AT + timedelta(seconds=age_seconds)
    )

    assert state["status"] == status
    assert state["stale"] is stale
    assert state["stale_after_minutes"] == 20
    assert UserSystemdWatchdogResponse().stale_after_minutes == 20
    assert read_user_systemd_watchdog_state(
        str(state_path), now=CHECKED_AT + timedelta(minutes=5), stale_after_minutes=5
    )["stale"] is True


def test_missing_oversized_symlink_or_invalid_state_is_unknown(tmp_path) -> None:
    missing = read_user_systemd_watchdog_state(str(tmp_path / "missing.state"))
    assert missing["status"] == "unknown"
    assert missing["stale_after_minutes"] == 20

    invalid_path = tmp_path / "invalid.state"
    invalid_path.write_text("status=healthy\nlast_check_at=invalid\n", encoding="utf-8")
    assert read_user_systemd_watchdog_state(str(invalid_path))["status"] == "unknown"

    oversized_path = tmp_path / "oversized.state"
    oversized_path.write_text(" " * (16 * 1024 + 1), encoding="utf-8")
    assert read_user_systemd_watchdog_state(str(oversized_path))["status"] == "unknown"

    symlink_path = tmp_path / "state-link"
    symlink_path.symlink_to(invalid_path)
    assert read_user_systemd_watchdog_state(str(symlink_path))["status"] == "unknown"

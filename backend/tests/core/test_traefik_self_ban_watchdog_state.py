import json
from datetime import datetime, timedelta, timezone

from app.core.traefik_self_ban_watchdog_state import (
    read_traefik_self_ban_watchdog_state,
)


def test_reads_bounded_self_ban_recovery_without_ip_fields(tmp_path) -> None:
    checked_at = datetime(2026, 8, 4, tzinfo=timezone.utc)
    state_path = tmp_path / "watchdog.json"
    state_path.write_text(
        json.dumps(
            {
                "version": 1,
                "status": "recovered",
                "checked_at": checked_at.isoformat(),
                "target_count": 2,
                "active_jail_count": 4,
                "detected_jails": ["traefik-web-probe", "../../private"],
                "remaining_jails": [],
                "auto_unban_attempted": True,
                "auto_unban_succeeded": True,
                "last_incident_at": checked_at.isoformat(),
                "last_recovery_at": checked_at.isoformat(),
                "last_error_code": None,
                "last_notification_status": "sent",
                "last_notification_at": checked_at.isoformat(),
                "events": [
                    {
                        "event": "auto_recovered",
                        "occurred_at": checked_at.isoformat(),
                        "jails": ["traefik-web-probe"],
                        "unbanned_count": 1,
                        "ip": "192.168.180.2",
                    }
                ],
                "traefik_ips": ["192.168.180.2"],
            }
        ),
        encoding="utf-8",
    )

    state = read_traefik_self_ban_watchdog_state(
        str(state_path), now=checked_at + timedelta(minutes=1)
    )

    assert state["status"] == "recovered"
    assert state["stale"] is False
    assert state["last_notification_status"] == "sent"
    assert state["events"] == [
        {
            "event": "auto_recovered",
            "occurred_at": checked_at,
            "jails": ["traefik-web-probe"],
            "unbanned_count": 1,
        }
    ]
    assert "target_count" not in state
    assert "traefik_ips" not in state
    assert "ip" not in state["events"][0]


def test_marks_old_state_stale_and_rejects_unbounded_values(tmp_path) -> None:
    checked_at = datetime(2026, 8, 4, tzinfo=timezone.utc)
    state_path = tmp_path / "watchdog.json"
    state_path.write_text(
        json.dumps(
            {
                "version": 1,
                "status": "blocked",
                "checked_at": checked_at.isoformat(),
                "active_jail_count": 1_000_000,
                "remaining_jails": ["valid-jail", "bad/jail"],
                "last_error_code": "private error text",
                "last_notification_status": "unexpected",
                "events": [],
            }
        ),
        encoding="utf-8",
    )

    state = read_traefik_self_ban_watchdog_state(
        str(state_path), now=checked_at + timedelta(minutes=5)
    )

    assert state["status"] == "blocked"
    assert state["stale"] is True
    assert state["active_jail_count"] == 0
    assert state["remaining_jails"] == ["valid-jail"]
    assert state["last_notification_status"] is None


def test_missing_or_invalid_state_is_unknown(tmp_path) -> None:
    missing = read_traefik_self_ban_watchdog_state(str(tmp_path / "missing.json"))
    assert missing["status"] == "unknown"
    assert missing["stale"] is False
    assert missing["events"] == []

    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text('{"version":2}', encoding="utf-8")
    invalid = read_traefik_self_ban_watchdog_state(str(invalid_path))
    assert invalid["status"] == "unknown"

    oversized_path = tmp_path / "oversized.json"
    oversized_path.write_text(" " * (64 * 1024 + 1), encoding="utf-8")
    oversized = read_traefik_self_ban_watchdog_state(str(oversized_path))
    assert oversized["status"] == "unknown"

    symlink_path = tmp_path / "state-link.json"
    symlink_path.symlink_to(invalid_path)
    linked = read_traefik_self_ban_watchdog_state(str(symlink_path))
    assert linked["status"] == "unknown"

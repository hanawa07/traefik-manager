import json
from datetime import datetime, timedelta, timezone

from app.core.cloudflare_ip_protection_state import (
    read_cloudflare_ip_protection_state,
)


CHECKED_AT = datetime(2026, 9, 1, 3, 12, 2, tzinfo=timezone.utc)
OK_COMPONENTS = {
    "traefik_web": "ok",
    "traefik_websecure": "ok",
    "hanastay_apache": "ok",
    "fail2ban_auth": "ok",
    "fail2ban_probe": "ok",
    "fail2ban_slow": "ok",
}


def write_state(path, *, status="healthy", components=None, checked_at=CHECKED_AT):
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "status": status,
                "checked_at": checked_at.isoformat(),
                "components": components or OK_COMPONENTS,
            }
        ),
        encoding="utf-8",
    )


def test_reads_healthy_and_stale_cloudflare_protection_state(tmp_path) -> None:
    state_path = tmp_path / "manager-status.json"
    write_state(state_path)

    current = read_cloudflare_ip_protection_state(
        str(state_path), now=CHECKED_AT + timedelta(hours=35)
    )
    stale = read_cloudflare_ip_protection_state(
        str(state_path), now=CHECKED_AT + timedelta(hours=36)
    )

    assert current == {
        "status": "healthy",
        "checked_at": CHECKED_AT,
        "stale": False,
        "stale_after_hours": 36,
        "components": OK_COMPONENTS,
    }
    assert stale["stale"] is True


def test_reads_drift_without_exposing_source_values(tmp_path) -> None:
    state_path = tmp_path / "manager-status.json"
    components = {**OK_COMPONENTS, "fail2ban_slow": "drift"}
    write_state(state_path, status="drift", components=components)

    state = read_cloudflare_ip_protection_state(str(state_path), now=CHECKED_AT)

    assert state["status"] == "drift"
    assert state["components"]["fail2ban_slow"] == "drift"
    assert set(state) == {
        "status",
        "checked_at",
        "stale",
        "stale_after_hours",
        "components",
    }


def test_missing_oversized_symlink_or_inconsistent_state_is_unknown(tmp_path) -> None:
    assert read_cloudflare_ip_protection_state(str(tmp_path / "missing"))["status"] == "unknown"

    invalid_path = tmp_path / "invalid.json"
    write_state(invalid_path, status="healthy", components={**OK_COMPONENTS, "fail2ban_auth": "drift"})
    assert read_cloudflare_ip_protection_state(str(invalid_path))["status"] == "unknown"

    invalid_path.write_text("[]", encoding="utf-8")
    assert read_cloudflare_ip_protection_state(str(invalid_path))["status"] == "unknown"

    write_state(invalid_path, status=["healthy"])
    assert read_cloudflare_ip_protection_state(str(invalid_path))["status"] == "unknown"

    oversized_path = tmp_path / "oversized.json"
    oversized_path.write_text(" " * (16 * 1024 + 1), encoding="utf-8")
    assert read_cloudflare_ip_protection_state(str(oversized_path))["status"] == "unknown"

    symlink_path = tmp_path / "state-link"
    symlink_path.symlink_to(invalid_path)
    assert read_cloudflare_ip_protection_state(str(symlink_path))["status"] == "unknown"

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


TRAEFIK_SELF_BAN_WATCHDOG_PATH = (
    "/host-state/traefik-manager/traefik-self-ban-watchdog.json"
)
TRAEFIK_SELF_BAN_STALE_AFTER_MINUTES = 5
MAX_STATE_BYTES = 64 * 1024
ALLOWED_STATUSES = {"healthy", "recovered", "blocked"}
ALLOWED_EVENTS = {"auto_recovered", "blocked", "recovered"}
ALLOWED_NOTIFICATION_STATUSES = {"sent", "failed", "disabled"}
SAFE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _bounded_count(value: object, maximum: int = 10_000) -> int:
    return value if type(value) is int and 0 <= value <= maximum else 0


def _safe_names(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return list(
        dict.fromkeys(
            item
            for item in value[:20]
            if isinstance(item, str) and SAFE_NAME_PATTERN.fullmatch(item)
        )
    )


def _parse_events(value: object) -> list[dict[str, object]]:
    events = []
    for raw in value[:10] if isinstance(value, list) else []:
        if not isinstance(raw, dict) or raw.get("event") not in ALLOWED_EVENTS:
            continue
        occurred_at = _parse_datetime(raw.get("occurred_at"))
        if occurred_at is None:
            continue
        events.append(
            {
                "event": raw["event"],
                "occurred_at": occurred_at,
                "jails": _safe_names(raw.get("jails")),
                "unbanned_count": _bounded_count(raw.get("unbanned_count"), 100),
            }
        )
    return events


def _unknown_state(stale_after_minutes: int) -> dict[str, object]:
    return {
        "status": "unknown",
        "checked_at": None,
        "stale": False,
        "stale_after_minutes": stale_after_minutes,
        "active_jail_count": 0,
        "remaining_jails": [],
        "last_incident_at": None,
        "last_recovery_at": None,
        "last_notification_status": None,
        "events": [],
    }


def read_traefik_self_ban_watchdog_state(
    path: str = TRAEFIK_SELF_BAN_WATCHDOG_PATH,
    *,
    now: datetime | None = None,
    stale_after_minutes: int = TRAEFIK_SELF_BAN_STALE_AFTER_MINUTES,
) -> dict[str, object]:
    state_path = Path(path)
    try:
        if state_path.is_symlink() or state_path.stat().st_size > MAX_STATE_BYTES:
            return _unknown_state(stale_after_minutes)
        raw = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return _unknown_state(stale_after_minutes)
    if not isinstance(raw, dict) or raw.get("version") != 1:
        return _unknown_state(stale_after_minutes)

    checked_at = _parse_datetime(raw.get("checked_at"))
    if checked_at is None:
        return _unknown_state(stale_after_minutes)
    status = raw.get("status")
    if status not in ALLOWED_STATUSES:
        status = "unknown"
    notification_status = raw.get("last_notification_status")
    if notification_status not in ALLOWED_NOTIFICATION_STATUSES:
        notification_status = None
    reference = now or datetime.now(timezone.utc)

    return {
        "status": status,
        "checked_at": checked_at,
        "stale": reference - checked_at >= timedelta(minutes=stale_after_minutes),
        "stale_after_minutes": stale_after_minutes,
        "active_jail_count": _bounded_count(raw.get("active_jail_count"), 1_000),
        "remaining_jails": _safe_names(raw.get("remaining_jails")),
        "last_incident_at": _parse_datetime(raw.get("last_incident_at")),
        "last_recovery_at": _parse_datetime(raw.get("last_recovery_at")),
        "last_notification_status": notification_status,
        "events": _parse_events(raw.get("events")),
    }

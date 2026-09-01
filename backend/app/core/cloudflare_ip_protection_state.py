import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


CLOUDFLARE_IP_PROTECTION_STATE_PATH = (
    "/host-state/cloudflare-ip-monitor/manager-status.json"
)
CLOUDFLARE_IP_PROTECTION_STALE_AFTER_HOURS = 36
MAX_STATE_BYTES = 16 * 1024
COMPONENT_NAMES = (
    "traefik_web",
    "traefik_websecure",
    "hanastay_apache",
    "fail2ban_auth",
    "fail2ban_probe",
    "fail2ban_slow",
)
VALID_STATUSES = {"healthy", "drift", "unavailable"}
VALID_COMPONENT_STATUSES = {"ok", "drift", "unavailable"}


def _unknown_state(stale_after_hours: int) -> dict[str, object]:
    return {
        "status": "unknown",
        "checked_at": None,
        "stale": False,
        "stale_after_hours": stale_after_hours,
        "components": {name: "unknown" for name in COMPONENT_NAMES},
    }


def _parse_checked_at(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        checked_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return checked_at if checked_at.tzinfo is not None else None


def read_cloudflare_ip_protection_state(
    path: str = CLOUDFLARE_IP_PROTECTION_STATE_PATH,
    *,
    now: datetime | None = None,
    stale_after_hours: int = CLOUDFLARE_IP_PROTECTION_STALE_AFTER_HOURS,
) -> dict[str, object]:
    state_path = Path(path)
    try:
        if state_path.is_symlink() or state_path.stat().st_size > MAX_STATE_BYTES:
            return _unknown_state(stale_after_hours)
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        return _unknown_state(stale_after_hours)

    if not isinstance(payload, dict):
        return _unknown_state(stale_after_hours)
    status = payload.get("status")
    checked_at = _parse_checked_at(payload.get("checked_at"))
    components = payload.get("components")
    if (
        payload.get("schema_version") != 1
        or not isinstance(status, str)
        or status not in VALID_STATUSES
        or checked_at is None
        or not isinstance(components, dict)
        or set(components) != set(COMPONENT_NAMES)
        or any(
            not isinstance(value, str) or value not in VALID_COMPONENT_STATUSES
            for value in components.values()
        )
    ):
        return _unknown_state(stale_after_hours)

    component_values = set(components.values())
    if (
        (status == "healthy" and component_values != {"ok"})
        or (status == "drift" and "drift" not in component_values)
        or (status == "unavailable" and "unavailable" not in component_values)
    ):
        return _unknown_state(stale_after_hours)

    reference = now or datetime.now(timezone.utc)
    return {
        "status": status,
        "checked_at": checked_at,
        "stale": reference - checked_at >= timedelta(hours=stale_after_hours),
        "stale_after_hours": stale_after_hours,
        "components": components,
    }

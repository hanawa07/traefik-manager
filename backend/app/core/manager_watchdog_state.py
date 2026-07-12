from datetime import datetime, timezone
from pathlib import Path


MANAGER_WATCHDOG_STATE_PATH = "/host-state/traefik-manager/manager-health-watchdog.state"


def read_manager_watchdog_state(
    path: str = MANAGER_WATCHDOG_STATE_PATH,
) -> dict[str, object]:
    state_path = Path(path)
    try:
        values = dict(
            line.split("=", 1)
            for line in state_path.read_text(encoding="utf-8").splitlines()
            if "=" in line
        )
        checked_at = datetime.fromtimestamp(state_path.stat().st_mtime, timezone.utc)
    except (OSError, ValueError):
        return {
            "external_watchdog_status": "unknown",
            "external_watchdog_checked_at": None,
        }

    status = values.get("status")
    if status not in {"healthy", "unhealthy"}:
        status = "unknown"
    return {
        "external_watchdog_status": status,
        "external_watchdog_checked_at": checked_at,
    }

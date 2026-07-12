from datetime import datetime, timedelta, timezone
from pathlib import Path


MANAGER_WATCHDOG_STATE_PATH = "/host-state/traefik-manager/manager-health-watchdog.state"
MANAGER_WATCHDOG_STALE_AFTER_MINUTES = 10


def read_manager_watchdog_state(
    path: str = MANAGER_WATCHDOG_STATE_PATH,
    *,
    now: datetime | None = None,
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
            "external_watchdog_consecutive_failures": 0,
            "external_watchdog_stale": False,
        }

    status = values.get("status")
    if status not in {"healthy", "unhealthy"}:
        status = "unknown"
    try:
        consecutive_failures = max(0, int(values.get("consecutive_failures", "0")))
    except ValueError:
        consecutive_failures = 0
    stale = (now or datetime.now(timezone.utc)) - checked_at >= timedelta(
        minutes=MANAGER_WATCHDOG_STALE_AFTER_MINUTES
    )
    return {
        "external_watchdog_status": status,
        "external_watchdog_checked_at": checked_at,
        "external_watchdog_consecutive_failures": consecutive_failures,
        "external_watchdog_stale": stale,
    }

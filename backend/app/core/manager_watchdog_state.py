from datetime import datetime, timedelta, timezone
from pathlib import Path


MANAGER_WATCHDOG_STATE_PATH = "/host-state/traefik-manager/manager-health-watchdog.state"
MANAGER_WATCHDOG_STALE_AFTER_MINUTES = 10


def _parse_epoch(value: str | None) -> datetime | None:
    try:
        epoch = int(value or "0")
        return datetime.fromtimestamp(epoch, timezone.utc) if epoch > 0 else None
    except (OSError, OverflowError, ValueError):
        return None


def read_manager_watchdog_state(
    path: str = MANAGER_WATCHDOG_STATE_PATH,
    *,
    now: datetime | None = None,
    stale_after_minutes: int = MANAGER_WATCHDOG_STALE_AFTER_MINUTES,
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
            "external_watchdog_stale_after_minutes": stale_after_minutes,
            "external_watchdog_last_alert_event": None,
            "external_watchdog_last_alert_success": None,
            "external_watchdog_last_alert_at": None,
        }

    status = values.get("status")
    if status not in {"healthy", "unhealthy"}:
        status = "unknown"
    try:
        consecutive_failures = max(0, int(values.get("consecutive_failures", "0")))
    except ValueError:
        consecutive_failures = 0
    last_alert_event = values.get("last_dispatch_event")
    if last_alert_event not in {"failure", "recovery"}:
        last_alert_event = None
    last_alert_success = {"1": True, "0": False}.get(values.get("last_dispatch_success"))
    last_alert_at = _parse_epoch(values.get("last_dispatch_at"))
    if last_alert_event is None:
        last_alert_success = None
        last_alert_at = None
    stale = (now or datetime.now(timezone.utc)) - checked_at >= timedelta(
        minutes=stale_after_minutes
    )
    return {
        "external_watchdog_status": status,
        "external_watchdog_checked_at": checked_at,
        "external_watchdog_consecutive_failures": consecutive_failures,
        "external_watchdog_stale": stale,
        "external_watchdog_stale_after_minutes": stale_after_minutes,
        "external_watchdog_last_alert_event": last_alert_event,
        "external_watchdog_last_alert_success": last_alert_success,
        "external_watchdog_last_alert_at": last_alert_at,
    }

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


USER_SYSTEMD_WATCHDOG_PATH = (
    "/host-state/traefik-manager/user-systemd-unit-watchdog.state"
)
USER_SYSTEMD_STALE_AFTER_MINUTES = 10
MAX_STATE_BYTES = 16 * 1024
SAFE_UNIT_PATTERN = re.compile(r"^[A-Za-z0-9_.@:-]{1,100}\.(?:timer|service)$")
MONITORED_COUNT_PATTERN = re.compile(r"^ok:(\d{1,4})-units$")
GLOBAL_ISSUE_CODES = {"baseline-invalid", "systemctl-unavailable"}
UNIT_ISSUE_CODES = {
    "unexpected-timer",
    "unit-not-loaded",
    "timer-disabled",
    "timer-inactive",
    "service-failed",
    "service-result",
    "unit-drift",
    "unit-unreadable",
}


def _unknown_state(stale_after_minutes: int) -> dict[str, object]:
    return {
        "status": "unknown",
        "checked_at": None,
        "stale": False,
        "stale_after_minutes": stale_after_minutes,
        "alert_active": False,
        "consecutive_failures": 0,
        "monitored_unit_count": 0,
        "issues": [],
    }


def _parse_epoch(value: str | None) -> datetime | None:
    try:
        epoch = int(value or "0")
        return datetime.fromtimestamp(epoch, timezone.utc) if epoch > 0 else None
    except (OSError, OverflowError, ValueError):
        return None


def _bounded_count(value: str | None, maximum: int) -> int:
    try:
        parsed = int(value or "0")
    except ValueError:
        return 0
    return parsed if 0 <= parsed <= maximum else 0


def _parse_issues(detail: str | None) -> list[dict[str, str | None]]:
    issues = []
    for token in (detail or "").split(",")[:20]:
        code, separator, unit = token.partition(":")
        if not separator and code in GLOBAL_ISSUE_CODES:
            issues.append({"code": code, "unit": None})
        elif code in UNIT_ISSUE_CODES and SAFE_UNIT_PATTERN.fullmatch(unit):
            issues.append({"code": code, "unit": unit})
    return issues


def _parse_monitored_count(detail: str | None) -> int:
    match = MONITORED_COUNT_PATTERN.fullmatch(detail or "")
    return int(match.group(1)) if match else 0


def read_user_systemd_watchdog_state(
    path: str = USER_SYSTEMD_WATCHDOG_PATH,
    *,
    now: datetime | None = None,
    stale_after_minutes: int = USER_SYSTEMD_STALE_AFTER_MINUTES,
) -> dict[str, object]:
    state_path = Path(path)
    try:
        if state_path.is_symlink() or state_path.stat().st_size > MAX_STATE_BYTES:
            return _unknown_state(stale_after_minutes)
        values = dict(
            line.split("=", 1)
            for line in state_path.read_text(encoding="utf-8").splitlines()
            if "=" in line
        )
    except (OSError, UnicodeError, ValueError):
        return _unknown_state(stale_after_minutes)

    status = values.get("status")
    checked_at = _parse_epoch(values.get("last_check_at"))
    if status not in {"healthy", "unhealthy"} or checked_at is None:
        return _unknown_state(stale_after_minutes)
    detail = values.get("detail")
    reference = now or datetime.now(timezone.utc)
    return {
        "status": status,
        "checked_at": checked_at,
        "stale": reference - checked_at >= timedelta(minutes=stale_after_minutes),
        "stale_after_minutes": stale_after_minutes,
        "alert_active": values.get("alert_active") == "1",
        "consecutive_failures": _bounded_count(
            values.get("consecutive_failures"), 100_000
        ),
        "monitored_unit_count": _parse_monitored_count(detail),
        "issues": _parse_issues(detail),
    }

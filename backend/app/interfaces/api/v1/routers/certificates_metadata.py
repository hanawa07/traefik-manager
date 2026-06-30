from datetime import datetime


def apply_alert_metadata(certificate: dict, state_entry: dict | None) -> dict:
    status = certificate.get("status")
    status_started_at_raw = (
        state_entry.get("status_started_at") if isinstance(state_entry, dict) else None
    )
    status_started_at = parse_iso_datetime(status_started_at_raw)
    return {
        **certificate,
        "status_started_at": status_started_at,
        "alerts_suppressed": bool(status in {"warning", "error"} and status_started_at is not None),
    }


def apply_preflight_metadata(certificate: dict, preflight_entry: dict | None) -> dict:
    if not isinstance(preflight_entry, dict):
        return {
            **certificate,
            "preflight_failure_streak": 0,
            "preflight_repeated_failure_active": False,
        }
    return {
        **certificate,
        "preflight_failure_streak": int(preflight_entry.get("failure_streak", 0)),
        "preflight_repeated_failure_active": bool(
            preflight_entry.get("repeated_failure_active", False)
        ),
    }


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None

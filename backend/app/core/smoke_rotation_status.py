from datetime import datetime, timedelta, timezone


SMOKE_ROTATION_STATUS_KEY = "smoke_viewer_rotation_status"
SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY = "smoke_viewer_rotation_last_attempt_at"
SMOKE_ROTATION_LAST_SUCCESS_AT_KEY = "smoke_viewer_rotation_last_success_at"
SMOKE_ROTATION_DETAIL_KEY = "smoke_viewer_rotation_detail"

SMOKE_ROTATION_STATUSES = {"running", "success", "failure"}
SMOKE_ROTATION_STALE_AFTER_DAYS = 35


def is_smoke_rotation_stale(
    last_success_at: str | None,
    *,
    now: datetime | None = None,
) -> bool:
    if not last_success_at:
        return False
    try:
        parsed = datetime.fromisoformat(last_success_at.strip().replace("Z", "+00:00"))
    except ValueError:
        return True

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc) - parsed.astimezone(timezone.utc) > timedelta(
        days=SMOKE_ROTATION_STALE_AFTER_DAYS
    )

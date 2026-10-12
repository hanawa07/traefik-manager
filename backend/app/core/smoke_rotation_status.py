import re
from datetime import datetime, timedelta, timezone


SMOKE_ROTATION_STATUS_KEY = "smoke_viewer_rotation_status"
SMOKE_ROTATION_LAST_ATTEMPT_AT_KEY = "smoke_viewer_rotation_last_attempt_at"
SMOKE_ROTATION_LAST_SUCCESS_AT_KEY = "smoke_viewer_rotation_last_success_at"
SMOKE_ROTATION_LAST_REVISION_KEY = "smoke_viewer_rotation_last_revision"
SMOKE_ROTATION_DETAIL_KEY = "smoke_viewer_rotation_detail"

SMOKE_ROTATION_STATUSES = {"running", "success", "failure"}
SMOKE_ROTATION_STALE_AFTER_DAYS = 35

SMOKE_ROTATION_ACCOUNT_UPDATE_STEPS = {
    "viewer 계정 갱신",
    "admin 계정 갱신",
}
SMOKE_ROTATION_VALIDATION_STEP = "회전 후 viewer·admin 스모크 검증"


def classify_smoke_rotation_failure(step: str | None) -> str:
    if step in SMOKE_ROTATION_ACCOUNT_UPDATE_STEPS:
        return "account_update"
    if step == SMOKE_ROTATION_VALIDATION_STEP:
        return "smoke_validation"
    return "execution"


def normalize_smoke_revision(revision: str | None) -> str | None:
    value = (revision or "").strip().lower()
    return value if re.fullmatch(r"[0-9a-f]{7,40}", value) else None


def is_smoke_success_stale(
    last_success_at: str | None,
    *,
    stale_after_days: int,
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
        days=stale_after_days
    )


def is_smoke_rotation_stale(
    last_success_at: str | None,
    *,
    now: datetime | None = None,
) -> bool:
    return is_smoke_success_stale(
        last_success_at,
        stale_after_days=SMOKE_ROTATION_STALE_AFTER_DAYS,
        now=now,
    )

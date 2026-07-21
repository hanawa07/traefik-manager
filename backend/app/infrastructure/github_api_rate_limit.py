from collections.abc import Mapping
from datetime import datetime, timezone

_latest_rate_limit: tuple[int, int, str] | None = None


def record_github_api_rate_limit(headers: Mapping[str, str]) -> None:
    global _latest_rate_limit
    try:
        remaining = int(headers.get("x-ratelimit-remaining", ""))
        limit = int(headers.get("x-ratelimit-limit", ""))
        reset_at = datetime.fromtimestamp(
            int(headers.get("x-ratelimit-reset", "")),
            tz=timezone.utc,
        ).isoformat()
    except (OSError, OverflowError, TypeError, ValueError):
        return
    if remaining < 0 or limit < 1 or remaining > limit:
        return
    if (
        _latest_rate_limit
        and _latest_rate_limit[2] == reset_at
        and _latest_rate_limit[0] < remaining
    ):
        return
    _latest_rate_limit = (remaining, limit, reset_at)


def read_github_api_rate_limit() -> dict[str, int | str | None]:
    if _latest_rate_limit is None:
        return {"remaining": None, "limit": None, "reset_at": None}
    remaining, limit, reset_at = _latest_rate_limit
    return {"remaining": remaining, "limit": limit, "reset_at": reset_at}

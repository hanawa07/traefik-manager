from collections.abc import Mapping
from datetime import datetime, timezone

GITHUB_API_REFRESH_RESERVE = 10
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


def github_api_manual_refresh_block_message(
    *,
    now: datetime | None = None,
) -> str | None:
    rate_limit = read_github_api_rate_limit()
    remaining = rate_limit["remaining"]
    reset_at = rate_limit["reset_at"]
    if not isinstance(remaining, int) or remaining > GITHUB_API_REFRESH_RESERVE:
        return None
    if not isinstance(reset_at, str):
        return None
    reset_time = datetime.fromisoformat(reset_at)
    if reset_time <= (now or datetime.now(timezone.utc)):
        return None
    return (
        "GitHub API 잔여량 보호를 위해 수동 새로고침을 잠갔습니다. "
        f"초기화 시각: {reset_at}"
    )


def github_api_rate_limit_error_message(
    status_code: int,
    headers: Mapping[str, str],
) -> str | None:
    if status_code != 403 or headers.get("x-ratelimit-remaining") != "0":
        return None
    record_github_api_rate_limit(headers)
    reset_at = read_github_api_rate_limit()["reset_at"]
    return (
        f"GitHub API 요청 한도가 소진되었습니다. 초기화 시각: {reset_at}"
        if isinstance(reset_at, str)
        else "GitHub API 요청 한도가 소진되었습니다"
    )

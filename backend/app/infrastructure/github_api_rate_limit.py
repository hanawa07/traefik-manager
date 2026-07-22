from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone

GITHUB_API_REFRESH_RESERVE = 10
_latest_rate_limit: tuple[int, int, str] | None = None
_latest_secondary_retry_at: str | None = None
_request_counter: ContextVar[list[int] | None] = ContextVar(
    "github_api_request_counter",
    default=None,
)


@contextmanager
def track_github_api_requests() -> Iterator[list[int]]:
    counter = [0]
    token = _request_counter.set(counter)
    try:
        yield counter
    finally:
        _request_counter.reset(token)


def record_github_api_rate_limit(headers: Mapping[str, str]) -> None:
    counter = _request_counter.get()
    if counter is not None:
        counter[0] += 1
    _update_github_api_rate_limit(headers)


def _update_github_api_rate_limit(headers: Mapping[str, str]) -> None:
    global _latest_rate_limit
    parsed = _parse_rate_limit_headers(headers)
    if parsed is None:
        return
    remaining, limit, reset_at = parsed
    if (
        _latest_rate_limit
        and _latest_rate_limit[2] == reset_at
        and _latest_rate_limit[0] < remaining
    ):
        return
    _latest_rate_limit = (remaining, limit, reset_at)


def read_github_api_rate_limit() -> dict[str, int | str | None]:
    if _latest_rate_limit is None:
        remaining = limit = reset_at = None
    else:
        remaining, limit, reset_at = _latest_rate_limit
    return {
        "remaining": remaining,
        "limit": limit,
        "reset_at": reset_at,
        "secondary_retry_at": _latest_secondary_retry_at,
    }


def github_api_manual_refresh_block_message(
    *,
    now: datetime | None = None,
) -> str | None:
    rate_limit = read_github_api_rate_limit()
    current_time = now or datetime.now(timezone.utc)
    secondary_retry_at = rate_limit["secondary_retry_at"]
    if isinstance(secondary_retry_at, str):
        retry_time = _parse_iso_datetime(secondary_retry_at)
        if retry_time is not None and retry_time > current_time:
            return (
                "GitHub API 보조 제한으로 수동 새로고침을 잠갔습니다. "
                f"재시도 시각: {secondary_retry_at}"
            )
    remaining = rate_limit["remaining"]
    reset_at = rate_limit["reset_at"]
    if not isinstance(remaining, int) or remaining > GITHUB_API_REFRESH_RESERVE:
        return None
    if not isinstance(reset_at, str):
        return None
    reset_time = _parse_iso_datetime(reset_at)
    if reset_time is None or reset_time <= current_time:
        return None
    return (
        "GitHub API 잔여량 보호를 위해 수동 새로고침을 잠갔습니다. "
        f"초기화 시각: {reset_at}"
    )


def github_api_rate_limit_error_message(
    status_code: int,
    headers: Mapping[str, str],
    response_body: str = "",
    *,
    now: datetime | None = None,
) -> str | None:
    global _latest_secondary_retry_at
    if status_code not in {403, 429}:
        return None
    _update_github_api_rate_limit(headers)
    body = response_body.casefold()
    is_secondary = (
        headers.get("retry-after") is not None
        or "secondary rate limit" in body
        or "abuse detection" in body
        or (status_code == 429 and headers.get("x-ratelimit-remaining") != "0")
    )
    if is_secondary:
        retry_at = _secondary_retry_at(headers, now or datetime.now(timezone.utc))
        _latest_secondary_retry_at = retry_at
        return (
            "GitHub API 보조 요청 제한에 걸렸습니다. "
            f"짧은 시간 요청을 줄이고 재시도 시각 이후 다시 확인하세요: {retry_at}"
        )
    if headers.get("x-ratelimit-remaining") != "0":
        return None
    reset_at = read_github_api_rate_limit()["reset_at"]
    return (
        f"GitHub API 요청 한도가 소진되었습니다. 초기화 시각: {reset_at}"
        if isinstance(reset_at, str)
        else "GitHub API 요청 한도가 소진되었습니다"
    )


def _parse_rate_limit_headers(
    headers: Mapping[str, str],
) -> tuple[int, int, str] | None:
    try:
        remaining = int(headers.get("x-ratelimit-remaining", ""))
        limit = int(headers.get("x-ratelimit-limit", ""))
        reset_at = datetime.fromtimestamp(
            int(headers.get("x-ratelimit-reset", "")),
            tz=timezone.utc,
        ).isoformat()
    except (OSError, OverflowError, TypeError, ValueError):
        return None
    if remaining < 0 or limit < 1 or remaining > limit:
        return None
    return remaining, limit, reset_at


def _secondary_retry_at(headers: Mapping[str, str], now: datetime) -> str:
    try:
        retry_after = int(headers.get("retry-after", ""))
    except (TypeError, ValueError):
        retry_after = -1
    if retry_after >= 0:
        return (now + timedelta(seconds=retry_after)).isoformat()
    parsed = _parse_rate_limit_headers(headers)
    if parsed is not None and parsed[0] == 0:
        return parsed[2]
    return (now + timedelta(minutes=1)).isoformat()


def _parse_iso_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)

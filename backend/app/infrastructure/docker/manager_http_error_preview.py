from datetime import datetime, timedelta, timezone

from app.application.manager_http_error_monitoring import (
    DEFAULT_MANAGER_HTTP_NOT_FOUND_THRESHOLD,
    DEFAULT_MANAGER_HTTP_SERVER_ERROR_THRESHOLD,
    MAX_MANAGER_HTTP_ERROR_THRESHOLD,
    MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
    MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
)
from app.infrastructure.docker.manager_http_errors import (
    MANAGER_HTTP_ERROR_WINDOW_HOURS,
    _as_utc,
    _match_excluded_path,
    _sample_coverage_percent,
)
from app.infrastructure.docker.manager_http_request_log_parser import (
    parse_manager_http_request_log,
)


def build_manager_http_error_preview(
    log_text: str | None,
    *,
    checked_at: datetime | None = None,
    window_minutes: int,
    excluded_paths: tuple[str, ...] = (),
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    effective_window_minutes = max(
        MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
        min(MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES, window_minutes),
    )
    window_start = current - timedelta(hours=MANAGER_HTTP_ERROR_WINDOW_HOURS)
    observed_since: datetime | None = None
    not_found_times: list[datetime] = []
    server_error_times: list[datetime] = []
    excluded_counts = {
        path: {
            "path": path,
            "not_found_count": 0,
            "server_error_count": 0,
            "last_seen_at": None,
        }
        for path in excluded_paths
    }

    if log_text is not None:
        for line in log_text.splitlines():
            request = parse_manager_http_request_log(line)
            if request is None:
                continue
            occurred_at, path, status_code, _ = request
            if occurred_at > current:
                continue
            if observed_since is None or occurred_at < observed_since:
                observed_since = occurred_at
            if occurred_at < window_start:
                continue
            if status_code != 404 and not 500 <= status_code <= 599:
                continue

            excluded_path = _match_excluded_path(path, excluded_paths)
            count_key = "not_found_count" if status_code == 404 else "server_error_count"
            if excluded_path is not None:
                excluded_count = excluded_counts[excluded_path]
                excluded_count[count_key] += 1
                last_seen_at = excluded_count["last_seen_at"]
                if last_seen_at is None or occurred_at > last_seen_at:
                    excluded_count["last_seen_at"] = occurred_at
            elif status_code == 404:
                not_found_times.append(occurred_at)
            else:
                server_error_times.append(occurred_at)

    peak_not_found_count = _max_window_count(not_found_times, effective_window_minutes)
    peak_server_error_count = _max_window_count(server_error_times, effective_window_minutes)
    return {
        "available": log_text is not None,
        "message": (
            "최근 24시간 로그의 구간별 최고치에 20% 여유를 적용했습니다"
            if log_text is not None
            else "backend 컨테이너 요청 로그를 읽지 못했습니다"
        ),
        "window_hours": MANAGER_HTTP_ERROR_WINDOW_HOURS,
        "window_minutes": effective_window_minutes,
        "checked_at": current,
        "observed_since": observed_since,
        "sample_coverage_percent": _sample_coverage_percent(current, observed_since),
        "peak_not_found_count": peak_not_found_count,
        "peak_server_error_count": peak_server_error_count,
        "recommended_not_found_threshold": _recommend_threshold(
            peak_not_found_count,
            DEFAULT_MANAGER_HTTP_NOT_FOUND_THRESHOLD,
        ),
        "recommended_server_error_threshold": _recommend_threshold(
            peak_server_error_count,
            DEFAULT_MANAGER_HTTP_SERVER_ERROR_THRESHOLD,
        ),
        "excluded_paths": list(excluded_counts.values()),
    }


def _max_window_count(occurred_at_values: list[datetime], window_minutes: int) -> int:
    ordered = sorted(occurred_at_values)
    window = timedelta(minutes=window_minutes)
    start = 0
    maximum = 0
    for end, occurred_at in enumerate(ordered):
        while occurred_at - ordered[start] > window:
            start += 1
        maximum = max(maximum, end - start + 1)
    return maximum


def _recommend_threshold(peak: int, default: int) -> int:
    margin = max(1, (peak + 4) // 5)
    return min(MAX_MANAGER_HTTP_ERROR_THRESHOLD, max(default, peak + margin))

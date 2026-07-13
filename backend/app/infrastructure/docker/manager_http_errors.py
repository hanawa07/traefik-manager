import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone


MANAGER_HTTP_ERROR_WINDOW_HOURS = 24
MANAGER_HTTP_ERROR_MAX_WINDOW_HOURS = 24
MANAGER_HTTP_ERROR_TOP_PATHS = 5


def build_manager_http_error_summary(
    log_text: str | None,
    *,
    checked_at: datetime | None = None,
    window_hours: int = MANAGER_HTTP_ERROR_WINDOW_HOURS,
    path_filter: str | None = None,
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    effective_window_hours = max(1, min(MANAGER_HTTP_ERROR_MAX_WINDOW_HOURS, window_hours))
    normalized_path_filter = _normalize_path_filter(path_filter)
    window_start = current - timedelta(hours=effective_window_hours)
    buckets = [
        {
            "started_at": window_start + timedelta(hours=index),
            "not_found_count": 0,
            "server_error_count": 0,
        }
        for index in range(effective_window_hours)
    ]
    if log_text is None:
        return _build_summary(
            available=False,
            message="backend 컨테이너 요청 로그를 읽지 못했습니다",
            checked_at=current,
            observed_since=None,
            buckets=buckets,
            path_counts={},
            window_hours=effective_window_hours,
            path_filter=normalized_path_filter,
        )

    observed_since: datetime | None = None
    path_counts: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "not_found_count": 0,
            "server_error_count": 0,
            "last_seen_at": window_start,
        }
    )
    for line in log_text.splitlines():
        request = _parse_request_log(line)
        if request is None:
            continue
        occurred_at, path, status_code = request
        if observed_since is None or occurred_at < observed_since:
            observed_since = occurred_at
        if occurred_at < window_start or occurred_at > current:
            continue
        if normalized_path_filter and normalized_path_filter not in path.lower():
            continue
        if status_code != 404 and not 500 <= status_code <= 599:
            continue

        bucket_index = min(
            int((occurred_at - window_start).total_seconds() // 3600),
            effective_window_hours - 1,
        )
        count_key = "not_found_count" if status_code == 404 else "server_error_count"
        buckets[bucket_index][count_key] += 1
        path_counts[path][count_key] += 1
        path_counts[path]["last_seen_at"] = max(
            path_counts[path]["last_seen_at"],
            occurred_at,
        )

    return _build_summary(
        available=True,
        message=f"backend 컨테이너 요청 로그의 최근 {effective_window_hours}시간을 집계했습니다",
        checked_at=current,
        observed_since=observed_since,
        buckets=buckets,
        path_counts=path_counts,
        window_hours=effective_window_hours,
        path_filter=normalized_path_filter,
    )


def count_manager_http_errors(
    log_text: str | None,
    *,
    checked_at: datetime | None = None,
    window_minutes: int,
    excluded_paths: tuple[str, ...] = (),
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    window_start = current - timedelta(minutes=max(1, window_minutes))
    not_found_count = 0
    server_error_count = 0
    path_counts: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "not_found_count": 0,
            "server_error_count": 0,
            "last_seen_at": window_start,
        }
    )
    if log_text is not None:
        for line in log_text.splitlines():
            request = _parse_request_log(line)
            if request is None:
                continue
            occurred_at, path, status_code = request
            if occurred_at < window_start or occurred_at > current:
                continue
            if _is_excluded_path(path, excluded_paths):
                continue
            if status_code != 404 and not 500 <= status_code <= 599:
                continue
            count_key = "not_found_count" if status_code == 404 else "server_error_count"
            if count_key == "not_found_count":
                not_found_count += 1
            else:
                server_error_count += 1
            path_counts[path][count_key] += 1
            path_counts[path]["last_seen_at"] = max(
                path_counts[path]["last_seen_at"], occurred_at
            )
    return {
        "available": log_text is not None,
        "checked_at": current,
        "window_minutes": max(1, window_minutes),
        "not_found_count": not_found_count,
        "server_error_count": server_error_count,
        "top_paths": _build_top_paths(path_counts),
    }


def _is_excluded_path(path: str, excluded_paths: tuple[str, ...]) -> bool:
    for excluded_path in excluded_paths:
        prefix = excluded_path.rstrip("/")
        if path == prefix or path.startswith(f"{prefix}/"):
            return True
    return False


def _build_summary(
    *,
    available: bool,
    message: str,
    checked_at: datetime,
    observed_since: datetime | None,
    buckets: list[dict[str, object]],
    path_counts: dict[str, dict[str, object]],
    window_hours: int,
    path_filter: str | None,
) -> dict[str, object]:
    total_not_found = sum(int(bucket["not_found_count"]) for bucket in buckets)
    total_server_error = sum(int(bucket["server_error_count"]) for bucket in buckets)
    top_paths = _build_top_paths(path_counts)
    return {
        "available": available,
        "message": message,
        "window_hours": window_hours,
        "path_filter": path_filter,
        "checked_at": checked_at,
        "observed_since": observed_since,
        "not_found_count": total_not_found,
        "server_error_count": total_server_error,
        "buckets": buckets,
        "top_paths": top_paths,
    }


def _build_top_paths(
    path_counts: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    return [
        {"path": path, **counts}
        for path, counts in sorted(
            path_counts.items(),
            key=lambda item: (
                -int(item[1]["not_found_count"])
                - int(item[1]["server_error_count"]),
                -_as_utc(item[1]["last_seen_at"]).timestamp(),
                item[0],
            ),
        )[:MANAGER_HTTP_ERROR_TOP_PATHS]
    ]


def _normalize_path_filter(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    return value.strip().lower()


def _parse_request_log(line: str) -> tuple[datetime, str, int] | None:
    json_start = line.find("{")
    if json_start < 0:
        return None
    try:
        payload = json.loads(line[json_start:])
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("message") != "요청 완료":
        return None

    path = payload.get("path")
    status_code = payload.get("status_code")
    occurred_at = _parse_timestamp(payload.get("time"))
    if (
        occurred_at is None
        or not isinstance(path, str)
        or not path.startswith("/api/")
        or isinstance(status_code, bool)
        or not isinstance(status_code, int)
    ):
        return None
    return occurred_at, path, status_code


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return _as_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

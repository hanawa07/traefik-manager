from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app.infrastructure.docker.manager_http_request_log_parser import (
    parse_manager_http_request_log,
)


DEPLOYMENT_CORRELATION_BEFORE_MINUTES = 1
DEPLOYMENT_CORRELATION_AFTER_MINUTES = 2
MAX_DEPLOYMENT_CORRELATIONS = 5
MAX_CORRELATION_PATHS = 3


def build_manager_http_deployment_correlations(
    log_text: str | None,
    deployment_history: list[dict[str, object]],
    *,
    checked_at: datetime,
    window_start: datetime,
    path_filter: str | None = None,
) -> list[dict[str, object]]:
    if log_text is None:
        return []

    parsed_requests = [
        request
        for line in log_text.splitlines()
        if (request := parse_manager_http_request_log(line)) is not None
        and request[0] <= checked_at
    ]
    observed_since = min(
        (request[0] for request in parsed_requests),
        default=None,
    )
    requests = [
        request
        for request in parsed_requests
        if (request[2] == 404 or 500 <= request[2] <= 599)
        and (not path_filter or path_filter in request[1].lower())
    ]
    correlations: list[dict[str, object]] = []
    for entry in deployment_history:
        started_at = _parse_datetime(entry.get("started_at"))
        completed_at = _parse_datetime(entry.get("completed_at"))
        if started_at is None or completed_at is None:
            continue
        correlation_start = started_at - timedelta(
            minutes=DEPLOYMENT_CORRELATION_BEFORE_MINUTES
        )
        correlation_end = completed_at + timedelta(
            minutes=DEPLOYMENT_CORRELATION_AFTER_MINUTES
        )
        if correlation_end < window_start or correlation_start > checked_at:
            continue

        effective_start = max(window_start, correlation_start)
        effective_end = min(checked_at, correlation_end)
        matching_requests = [
            request
            for request in requests
            if effective_start <= request[0] <= effective_end
        ]
        correlations.append(
            {
                "version": str(entry.get("version") or "-"),
                "revision": str(entry.get("revision") or ""),
                "status": str(entry.get("status") or "success"),
                "started_at": started_at,
                "completed_at": completed_at,
                "window_started_at": correlation_start,
                "window_ended_at": correlation_end,
                "sample_complete": (
                    observed_since is not None and observed_since <= correlation_start
                ),
                "not_found_count": sum(
                    request[2] == 404 for request in matching_requests
                ),
                "server_error_count": sum(
                    500 <= request[2] <= 599 for request in matching_requests
                ),
                "top_paths": _build_top_paths(matching_requests),
            }
        )
        if len(correlations) >= MAX_DEPLOYMENT_CORRELATIONS:
            break
    return correlations


def _build_top_paths(
    requests: list[tuple[datetime, str, int, float | None]],
) -> list[dict[str, object]]:
    path_counts: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "not_found_count": 0,
            "server_error_count": 0,
            "last_seen_at": datetime.min.replace(tzinfo=timezone.utc),
        }
    )
    for occurred_at, path, status_code, _ in requests:
        count_key = "not_found_count" if status_code == 404 else "server_error_count"
        path_counts[path][count_key] += 1
        path_counts[path]["last_seen_at"] = max(
            path_counts[path]["last_seen_at"], occurred_at
        )
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
        )[:MAX_CORRELATION_PATHS]
    ]


def _parse_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return _as_utc(value)
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

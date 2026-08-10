import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from app.infrastructure.traefik.runtime_status_builder import MANAGER_TAILNET_ROUTER


MAX_CLIENT_CANCELLATION_PATHS = 3
_ACCESS_LOG_PATTERN = re.compile(
    r'\[(?P<occurred_at>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\] '
    r'"[A-Z]+ (?P<target>\S+) HTTP/[^"]+" (?P<status_code>\d{3}) \d+ '
    r'"[^"]*" "[^"]*" \d+ "(?P<router>[^"]+)"'
)


def parse_manager_traefik_access_log(
    line: str,
) -> tuple[datetime, str, int] | None:
    match = _ACCESS_LOG_PATTERN.search(line)
    if match is None or match.group("router") != MANAGER_TAILNET_ROUTER:
        return None
    try:
        occurred_at = datetime.strptime(
            match.group("occurred_at"),
            "%d/%b/%Y:%H:%M:%S %z",
        ).astimezone(timezone.utc)
        status_code = int(match.group("status_code"))
    except (ValueError, TypeError):
        return None
    path = urlsplit(match.group("target")).path
    if not path.startswith("/api/"):
        return None
    return occurred_at, path, status_code


def build_manager_http_client_cancellation_summary(
    log_text: str | None,
    *,
    checked_at: datetime,
    window_hours: int,
    path_filter: str | None = None,
) -> dict[str, object]:
    current = _as_utc(checked_at)
    effective_window_hours = max(1, window_hours)
    window_start = current - timedelta(hours=effective_window_hours)
    observed_since: datetime | None = None
    path_counts: dict[str, dict[str, object]] = defaultdict(
        lambda: {"count": 0, "last_seen_at": window_start}
    )

    if log_text is not None:
        for line in log_text.splitlines():
            request = parse_manager_traefik_access_log(line)
            if request is None:
                continue
            occurred_at, path, status_code = request
            if occurred_at < window_start or occurred_at > current:
                continue
            if observed_since is None or occurred_at < observed_since:
                observed_since = occurred_at
            if path_filter and path_filter not in path.lower():
                continue
            # Traefik 499 is an ingress-side client cancellation, not a backend error.
            if status_code != 499:
                continue
            path_counts[path]["count"] += 1
            path_counts[path]["last_seen_at"] = max(
                path_counts[path]["last_seen_at"], occurred_at
            )

    return {
        "available": log_text is not None,
        "message": (
            "Traefik 최근 로그 표본의 Manager API 클라이언트 취소를 집계했습니다"
            if log_text is not None
            else "Traefik 접근 로그를 읽지 못했습니다"
        ),
        "observed_since": observed_since,
        "sample_coverage_percent": _sample_coverage_percent(
            current,
            observed_since,
            effective_window_hours,
        ),
        "count": sum(int(item["count"]) for item in path_counts.values()),
        "top_paths": [
            {"path": path, **counts}
            for path, counts in sorted(
                path_counts.items(),
                key=lambda item: (
                    -int(item[1]["count"]),
                    -_as_utc(item[1]["last_seen_at"]).timestamp(),
                    item[0],
                ),
            )[:MAX_CLIENT_CANCELLATION_PATHS]
        ],
    }


def _sample_coverage_percent(
    checked_at: datetime,
    observed_since: datetime | None,
    window_hours: int,
) -> int:
    if observed_since is None:
        return 0
    elapsed_seconds = max(0.0, (checked_at - observed_since).total_seconds())
    return min(100, int(elapsed_seconds / (window_hours * 60 * 60) * 100))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

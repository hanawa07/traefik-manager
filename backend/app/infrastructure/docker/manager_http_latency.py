from datetime import datetime, timedelta, timezone
from math import ceil

from app.infrastructure.docker.manager_http_errors import (
    parse_manager_http_request_log,
)

SETTINGS_HISTORY_LATENCY_PATH = "/api/v1/settings/test-history"
SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES = 60
SETTINGS_HISTORY_LATENCY_THRESHOLD_MS = 100.0
SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES = 5


def build_settings_history_latency_summary(
    log_text: str | None,
    *,
    checked_at: datetime | None = None,
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    cutoff = current - timedelta(minutes=SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES)
    durations: list[float] = []
    if log_text is not None:
        for line in log_text.splitlines():
            request = parse_manager_http_request_log(line)
            if request is None:
                continue
            occurred_at, path, _, duration_ms = request
            if (
                path == SETTINGS_HISTORY_LATENCY_PATH
                and duration_ms is not None
                and cutoff <= occurred_at <= current
            ):
                durations.append(duration_ms)

    durations.sort()
    p95_ms = (
        durations[max(0, ceil(len(durations) * 0.95) - 1)]
        if durations
        else None
    )
    ready = len(durations) >= SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES
    return {
        "available": log_text is not None,
        "ready": ready,
        "checked_at": current,
        "path": SETTINGS_HISTORY_LATENCY_PATH,
        "window_minutes": SETTINGS_HISTORY_LATENCY_WINDOW_MINUTES,
        "sample_count": len(durations),
        "minimum_sample_count": SETTINGS_HISTORY_LATENCY_MINIMUM_SAMPLES,
        "p95_ms": p95_ms,
        "threshold_ms": SETTINGS_HISTORY_LATENCY_THRESHOLD_MS,
        "breached": bool(
            ready
            and p95_ms is not None
            and p95_ms > SETTINGS_HISTORY_LATENCY_THRESHOLD_MS
        ),
    }


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

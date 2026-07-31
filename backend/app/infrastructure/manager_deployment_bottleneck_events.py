import fcntl
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.infrastructure.github_actions_run import build_actions_run_api_url
from app.infrastructure.manager_deployment_bottleneck_config import (
    MAX_EVENT_RETENTION_DAYS,
    MIN_EVENT_RETENTION_DAYS,
    read_bottleneck_pairs,
)
from app.infrastructure.manager_deployment_bottleneck_event_codec import (
    DEPLOYMENT_STAGES,
    event_timestamp,
    iso_datetime,
    normalize_event_lines,
    string_value,
)
from app.infrastructure.manager_deployment_bottleneck_event_storage import (
    read_event_lines,
    resolve_events_path,
    write_events,
)

MAX_EVENTS = 20
MAX_RETAINED_EVENTS = 100


def read_manager_deployment_bottleneck_event_state(
    path: str | Path | None = None,
) -> dict[str, object]:
    events_path = resolve_events_path(path)
    events = _read_normalized_events(events_path)
    return {
        **_read_event_storage_warning(events_path),
        **_event_storage_summary(events),
        "events": events[:MAX_EVENTS],
    }


def read_manager_deployment_bottleneck_events(
    path: str | Path | None = None,
) -> list[dict[str, object]]:
    return _read_normalized_events(resolve_events_path(path))[:MAX_EVENTS]


def preview_manager_deployment_bottleneck_event_cleanup(
    retention_days: int,
    path: str | Path | None = None,
    *,
    now: datetime | None = None,
) -> dict[str, object]:
    _validate_event_retention_days(retention_days)
    lines = read_event_lines(resolve_events_path(path), strict=True)
    _, result = _calculate_event_cleanup(lines, retention_days, now)
    return result


def prune_manager_deployment_bottleneck_events(
    retention_days: int,
    path: str | Path | None = None,
    *,
    now: datetime | None = None,
) -> dict[str, object]:
    _validate_event_retention_days(retention_days)

    events_path = resolve_events_path(path)
    events_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = Path(f"{events_path}.lock")
    with lock_path.open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        lines = read_event_lines(events_path, strict=True)
        retained, result = _calculate_event_cleanup(lines, retention_days, now)
        write_events(events_path, retained)

    return result


def _validate_event_retention_days(retention_days: int) -> None:
    if not MIN_EVENT_RETENTION_DAYS <= retention_days <= MAX_EVENT_RETENTION_DAYS:
        raise ValueError("event retention days out of range")


def _calculate_event_cleanup(
    lines: list[str],
    retention_days: int,
    now: datetime | None,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    reference_time = now or datetime.now(timezone.utc)
    if reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)
    cutoff = reference_time.astimezone(timezone.utc) - timedelta(days=retention_days)
    retained = [
        event
        for event in normalize_event_lines(lines)
        if event_timestamp(string_value(event.get("occurred_at"))) >= cutoff
    ][:MAX_RETAINED_EVENTS]
    return retained, {
        "retention_days": retention_days,
        "deleted_count": len(lines) - len(retained),
        **_event_storage_summary(retained),
    }


def _read_event_storage_warning(events_path: Path) -> dict[str, object]:
    values = read_bottleneck_pairs(Path(f"{events_path}.storage-warning.state"))
    run_url = values.get("run_url") or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    return {
        "storage_warning_active": bool(values),
        "storage_warning_alerted_at": iso_datetime(values.get("alerted_at")),
        "storage_warning_run_url": run_url,
    }


def _read_normalized_events(events_path: Path) -> list[dict[str, object]]:
    return normalize_event_lines(read_event_lines(events_path))[:MAX_RETAINED_EVENTS]


def _event_storage_summary(events: list[dict[str, object]]) -> dict[str, object]:
    occurred_values = [
        value
        for event in events
        if (value := string_value(event.get("occurred_at"))) is not None
    ]
    return {
        "retained_event_count": len(events),
        "oldest_event_at": (
            min(occurred_values, key=event_timestamp) if occurred_values else None
        ),
        "newest_event_at": (
            max(occurred_values, key=event_timestamp) if occurred_values else None
        ),
    }

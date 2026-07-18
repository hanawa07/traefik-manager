import fcntl
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import settings
from app.infrastructure.github_actions_run import build_actions_run_api_url

DEFAULT_THRESHOLD_MS = 60_000
DEFAULT_CONSECUTIVE_COUNT = 3
DEFAULT_EVENT_RETENTION_DAYS = 90
MIN_THRESHOLD_MS = 1_000
MAX_THRESHOLD_MS = 900_000
MIN_CONSECUTIVE_COUNT = 1
MAX_CONSECUTIVE_COUNT = 20
MIN_EVENT_RETENTION_DAYS = 1
MAX_EVENT_RETENTION_DAYS = 3650
MAX_STATE_BYTES = 4 * 1024
MAX_EVENTS_BYTES = 128 * 1024
MAX_EVENTS = 20
MAX_RETAINED_EVENTS = 100
ALERT_STATUSES = {"not_checked", "no_history", "normal", "pending", "alerted", "request_failed"}
ALERT_EVENTS = {"alerted", "cleared"}
CONFIG_SOURCES = {"settings", "environment"}
DEPLOYMENT_STAGES = {
    "prepare",
    "build",
    "migration_preflight",
    "candidate_health",
    "route_switch",
    "leader_handover",
    "public_probe",
    "state_write",
}


def read_manager_deployment_bottleneck_config(
    path: str | Path | None = None,
) -> dict[str, int]:
    values = _read_pairs(Path(path or settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH))
    return {
        "threshold_ms": _bounded_int(
            values.get("threshold_ms"),
            default=DEFAULT_THRESHOLD_MS,
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "consecutive_count": _bounded_int(
            values.get("consecutive_count"),
            default=DEFAULT_CONSECUTIVE_COUNT,
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
        "event_retention_days": _bounded_int(
            values.get("event_retention_days"),
            default=DEFAULT_EVENT_RETENTION_DAYS,
            minimum=MIN_EVENT_RETENTION_DAYS,
            maximum=MAX_EVENT_RETENTION_DAYS,
        ),
    }


def write_manager_deployment_bottleneck_config(
    threshold_ms: int,
    consecutive_count: int,
    event_retention_days: int = DEFAULT_EVENT_RETENTION_DAYS,
    path: str | Path | None = None,
) -> dict[str, int]:
    config_path = Path(path or settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=config_path.parent,
            encoding="utf-8",
            prefix=f".{config_path.name}.",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(
                f"threshold_ms={threshold_ms}\n"
                f"consecutive_count={consecutive_count}\n"
                f"event_retention_days={event_retention_days}\n"
            )
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o644)
        os.replace(temporary_path, config_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return read_manager_deployment_bottleneck_config(config_path)


def read_manager_deployment_bottleneck_state(
    status_path: str | Path | None = None,
    config_path: str | Path | None = None,
    events_path: str | Path | None = None,
) -> dict[str, object]:
    config = read_manager_deployment_bottleneck_config(config_path)
    path = Path(status_path or f"{settings.MANAGER_DEPLOYMENT_HISTORY_PATH}.bottleneck-alert.status")
    values = _read_pairs(path)
    status = values.get("status", "not_checked")
    if status not in ALERT_STATUSES:
        status = "not_checked"
    run_url = values.get("run_url") or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    slowest_stage = values.get("slowest_stage") or None
    if slowest_stage not in DEPLOYMENT_STAGES:
        slowest_stage = None
    effective_threshold_ms = _bounded_int(
        values.get("effective_threshold_ms"),
        default=config["threshold_ms"],
        minimum=MIN_THRESHOLD_MS,
        maximum=MAX_THRESHOLD_MS,
    )
    effective_consecutive_count = _bounded_int(
        values.get("effective_consecutive_count"),
        default=config["consecutive_count"],
        minimum=MIN_CONSECUTIVE_COUNT,
        maximum=MAX_CONSECUTIVE_COUNT,
    )
    effective_event_retention_days = _bounded_int(
        values.get("effective_event_retention_days"),
        default=config["event_retention_days"],
        minimum=MIN_EVENT_RETENTION_DAYS,
        maximum=MAX_EVENT_RETENTION_DAYS,
    )
    events = _read_normalized_events(_manager_deployment_bottleneck_events_path(events_path))
    return {
        "status": status,
        "configured_threshold_ms": config["threshold_ms"],
        "configured_consecutive_count": config["consecutive_count"],
        "configured_event_retention_days": config["event_retention_days"],
        "effective_threshold_ms": effective_threshold_ms,
        "effective_consecutive_count": effective_consecutive_count,
        "effective_event_retention_days": effective_event_retention_days,
        "threshold_source": _config_source(
            values.get("threshold_source"),
            config["threshold_ms"] != effective_threshold_ms,
        ),
        "consecutive_source": _config_source(
            values.get("consecutive_source"),
            config["consecutive_count"] != effective_consecutive_count,
        ),
        "event_retention_source": _config_source(
            values.get("event_retention_source"),
            config["event_retention_days"] != effective_event_retention_days,
        ),
        "current_consecutive_count": _bounded_int(
            values.get("current_consecutive_count"),
            default=0,
            minimum=0,
            maximum=10_000,
        ),
        "checked_at": _iso_datetime(values.get("checked_at")),
        "latest_version": (values.get("latest_version") or None),
        "slowest_stage": slowest_stage,
        "slowest_ms": _bounded_int(
            values.get("slowest_ms"),
            default=0,
            minimum=0,
            maximum=24 * 60 * 60 * 1000,
        ),
        "alerted_at": _iso_datetime(values.get("alerted_at")),
        "run_url": run_url,
        **_event_storage_summary(events),
        "events": events[:MAX_EVENTS],
    }


def read_manager_deployment_bottleneck_events(
    path: str | Path | None = None,
) -> list[dict[str, object]]:
    return _read_normalized_events(_manager_deployment_bottleneck_events_path(path))[:MAX_EVENTS]


def prune_manager_deployment_bottleneck_events(
    retention_days: int,
    path: str | Path | None = None,
    *,
    now: datetime | None = None,
) -> dict[str, object]:
    if not MIN_EVENT_RETENTION_DAYS <= retention_days <= MAX_EVENT_RETENTION_DAYS:
        raise ValueError("event retention days out of range")

    events_path = _manager_deployment_bottleneck_events_path(path)
    events_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = Path(f"{events_path}.lock")
    with lock_path.open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        lines = _read_event_lines(events_path, strict=True)
        events = _normalize_event_lines(lines)
        reference_time = now or datetime.now(timezone.utc)
        if reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)
        cutoff = reference_time.astimezone(timezone.utc) - timedelta(days=retention_days)
        retained = [
            event
            for event in events
            if _event_timestamp(_string(event.get("occurred_at"))) >= cutoff
        ][:MAX_RETAINED_EVENTS]
        _write_events(events_path, retained)

    return {
        "retention_days": retention_days,
        "deleted_count": len(lines) - len(retained),
        **_event_storage_summary(retained),
    }


def _manager_deployment_bottleneck_events_path(path: str | Path | None) -> Path:
    return Path(path or f"{settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH}.events.jsonl")


def _read_normalized_events(events_path: Path) -> list[dict[str, object]]:
    return _normalize_event_lines(_read_event_lines(events_path))[:MAX_RETAINED_EVENTS]


def _read_event_lines(events_path: Path, *, strict: bool = False) -> list[str]:
    try:
        if events_path.stat().st_size > MAX_EVENTS_BYTES:
            if strict:
                raise ValueError("event history file is too large")
            return []
        return events_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    except (OSError, UnicodeError):
        if strict:
            raise
        return []


def _normalize_event_lines(lines: list[str]) -> list[dict[str, object]]:
    events = []

    for line in reversed(lines):
        try:
            value = json.loads(line)
        except (json.JSONDecodeError, TypeError):
            continue
        event = _normalize_event(value)
        if event is not None:
            events.append(event)
    return events


def _write_events(events_path: Path, events: list[dict[str, object]]) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=events_path.parent,
            encoding="utf-8",
            prefix=f".{events_path.name}.",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            for event in reversed(events):
                temporary_file.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")))
                temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o644)
        os.replace(temporary_path, events_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _event_storage_summary(events: list[dict[str, object]]) -> dict[str, object]:
    occurred_values = [
        value
        for event in events
        if (value := _string(event.get("occurred_at"))) is not None
    ]
    return {
        "retained_event_count": len(events),
        "oldest_event_at": min(occurred_values, key=_event_timestamp)
        if occurred_values
        else None,
        "newest_event_at": max(occurred_values, key=_event_timestamp)
        if occurred_values
        else None,
    }


def _event_timestamp(value: str | None) -> datetime:
    return _parse_datetime(value) or datetime.min.replace(tzinfo=timezone.utc)


def _normalize_event(value: object) -> dict[str, object] | None:
    if not isinstance(value, dict):
        return None
    event_name = value.get("event")
    if not isinstance(event_name, str) or event_name not in ALERT_EVENTS:
        return None
    occurred_at = _iso_datetime(_string(value.get("occurred_at")))
    if occurred_at is None:
        return None
    run_url = _string(value.get("run_url")) or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    slowest_stage = _string(value.get("slowest_stage")) or None
    if slowest_stage not in DEPLOYMENT_STAGES:
        slowest_stage = None
    latest_version = _string(value.get("latest_version")) or None
    if latest_version and (len(latest_version) > 100 or "\x00" in latest_version):
        latest_version = None
    return {
        "event": event_name,
        "occurred_at": occurred_at,
        "threshold_ms": _bounded_int(
            value.get("threshold_ms"),
            default=DEFAULT_THRESHOLD_MS,
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "required_consecutive_count": _bounded_int(
            value.get("required_consecutive_count"),
            default=DEFAULT_CONSECUTIVE_COUNT,
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
        "current_consecutive_count": _bounded_int(
            value.get("current_consecutive_count"),
            default=0,
            minimum=0,
            maximum=10_000,
        ),
        "latest_version": latest_version,
        "slowest_stage": slowest_stage,
        "slowest_ms": _bounded_int(
            value.get("slowest_ms"),
            default=0,
            minimum=0,
            maximum=24 * 60 * 60 * 1000,
        ),
        "run_url": run_url,
    }


def _read_pairs(path: Path) -> dict[str, str]:
    try:
        if path.stat().st_size > MAX_STATE_BYTES:
            return {}
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        return {}
    return {
        key: value
        for line in lines
        if "=" in line
        for key, value in [line.split("=", 1)]
        if key and "\x00" not in value
    }


def _bounded_int(value: object, *, default: int, minimum: int, maximum: int) -> int:
    try:
        if type(value) is int:
            parsed = value
        elif isinstance(value, str):
            parsed = int(value)
        else:
            return default
    except ValueError:
        return default
    return parsed if minimum <= parsed <= maximum else default


def _config_source(value: str | None, differs: bool) -> str:
    if value in CONFIG_SOURCES:
        return value
    return "environment" if differs else "settings"


def _iso_datetime(value: str | None) -> str | None:
    return value if _parse_datetime(value) is not None else None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _string(value: object) -> str | None:
    return value if isinstance(value, str) else None

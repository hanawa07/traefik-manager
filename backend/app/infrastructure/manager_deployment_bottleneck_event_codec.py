import json
from datetime import datetime, timezone

from app.infrastructure.github_actions_run import build_actions_run_api_url
from app.infrastructure.manager_deployment_bottleneck_config import (
    DEFAULT_CONSECUTIVE_COUNT,
    DEFAULT_THRESHOLD_MS,
    MAX_CONSECUTIVE_COUNT,
    MAX_THRESHOLD_MS,
    MIN_CONSECUTIVE_COUNT,
    MIN_THRESHOLD_MS,
    bounded_int,
)

ALERT_EVENTS = {"alerted", "cleared"}
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


def normalize_event_lines(lines: list[str]) -> list[dict[str, object]]:
    events = []
    for line in reversed(lines):
        try:
            value = json.loads(line)
        except (json.JSONDecodeError, TypeError):
            continue
        event = normalize_event(value)
        if event is not None:
            events.append(event)
    return events


def event_timestamp(value: str | None) -> datetime:
    return parse_datetime(value) or datetime.min.replace(tzinfo=timezone.utc)


def normalize_event(value: object) -> dict[str, object] | None:
    if not isinstance(value, dict):
        return None
    event_name = value.get("event")
    if not isinstance(event_name, str) or event_name not in ALERT_EVENTS:
        return None
    occurred_at = iso_datetime(string_value(value.get("occurred_at")))
    if occurred_at is None:
        return None
    run_url = string_value(value.get("run_url")) or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    slowest_stage = string_value(value.get("slowest_stage")) or None
    if slowest_stage not in DEPLOYMENT_STAGES:
        slowest_stage = None
    latest_version = string_value(value.get("latest_version")) or None
    if latest_version and (len(latest_version) > 100 or "\x00" in latest_version):
        latest_version = None
    return {
        "event": event_name,
        "occurred_at": occurred_at,
        "threshold_ms": bounded_int(
            value.get("threshold_ms"),
            default=DEFAULT_THRESHOLD_MS,
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "required_consecutive_count": bounded_int(
            value.get("required_consecutive_count"),
            default=DEFAULT_CONSECUTIVE_COUNT,
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
        "current_consecutive_count": bounded_int(
            value.get("current_consecutive_count"),
            default=0,
            minimum=0,
            maximum=10_000,
        ),
        "latest_version": latest_version,
        "slowest_stage": slowest_stage,
        "slowest_ms": bounded_int(
            value.get("slowest_ms"),
            default=0,
            minimum=0,
            maximum=24 * 60 * 60 * 1000,
        ),
        "run_url": run_url,
    }


def iso_datetime(value: str | None) -> str | None:
    return value if parse_datetime(value) is not None else None


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def string_value(value: object) -> str | None:
    return value if isinstance(value, str) else None

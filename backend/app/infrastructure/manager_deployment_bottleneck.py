from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.infrastructure.github_actions_run import build_actions_run_api_url
from app.infrastructure.manager_deployment_bottleneck_config import (
    MAX_CONSECUTIVE_COUNT,
    MAX_EVENT_RETENTION_DAYS,
    MAX_THRESHOLD_MS,
    MIN_CONSECUTIVE_COUNT,
    MIN_EVENT_RETENTION_DAYS,
    MIN_THRESHOLD_MS,
    bounded_int,
    read_bottleneck_pairs,
    read_manager_deployment_bottleneck_config,
    resolve_config_source,
)
from app.infrastructure.manager_deployment_bottleneck_events import (
    DEPLOYMENT_STAGES,
    read_manager_deployment_bottleneck_event_state,
)

ALERT_STATUSES = {
    "not_checked",
    "no_history",
    "normal",
    "pending",
    "alerted",
    "request_failed",
}


def read_manager_deployment_bottleneck_state(
    status_path: str | Path | None = None,
    config_path: str | Path | None = None,
    events_path: str | Path | None = None,
) -> dict[str, object]:
    config = read_manager_deployment_bottleneck_config(config_path)
    path = Path(
        status_path
        or f"{settings.MANAGER_DEPLOYMENT_HISTORY_PATH}.bottleneck-alert.status"
    )
    values = read_bottleneck_pairs(path)
    status = values.get("status", "not_checked")
    if status not in ALERT_STATUSES:
        status = "not_checked"
    run_url = values.get("run_url") or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    slowest_stage = values.get("slowest_stage") or None
    if slowest_stage not in DEPLOYMENT_STAGES:
        slowest_stage = None
    effective_threshold_ms = bounded_int(
        values.get("effective_threshold_ms"),
        default=config["threshold_ms"],
        minimum=MIN_THRESHOLD_MS,
        maximum=MAX_THRESHOLD_MS,
    )
    effective_consecutive_count = bounded_int(
        values.get("effective_consecutive_count"),
        default=config["consecutive_count"],
        minimum=MIN_CONSECUTIVE_COUNT,
        maximum=MAX_CONSECUTIVE_COUNT,
    )
    effective_event_retention_days = bounded_int(
        values.get("effective_event_retention_days"),
        default=config["event_retention_days"],
        minimum=MIN_EVENT_RETENTION_DAYS,
        maximum=MAX_EVENT_RETENTION_DAYS,
    )
    return {
        "status": status,
        "configured_threshold_ms": config["threshold_ms"],
        "configured_consecutive_count": config["consecutive_count"],
        "configured_event_retention_days": config["event_retention_days"],
        "effective_threshold_ms": effective_threshold_ms,
        "effective_consecutive_count": effective_consecutive_count,
        "effective_event_retention_days": effective_event_retention_days,
        "threshold_source": resolve_config_source(
            values.get("threshold_source"),
            config["threshold_ms"] != effective_threshold_ms,
        ),
        "consecutive_source": resolve_config_source(
            values.get("consecutive_source"),
            config["consecutive_count"] != effective_consecutive_count,
        ),
        "event_retention_source": resolve_config_source(
            values.get("event_retention_source"),
            config["event_retention_days"] != effective_event_retention_days,
        ),
        "current_consecutive_count": bounded_int(
            values.get("current_consecutive_count"),
            default=0,
            minimum=0,
            maximum=10_000,
        ),
        "checked_at": _iso_datetime(values.get("checked_at")),
        "latest_version": values.get("latest_version") or None,
        "slowest_stage": slowest_stage,
        "slowest_ms": bounded_int(
            values.get("slowest_ms"),
            default=0,
            minimum=0,
            maximum=24 * 60 * 60 * 1000,
        ),
        "alerted_at": _iso_datetime(values.get("alerted_at")),
        "run_url": run_url,
        **read_manager_deployment_bottleneck_event_state(events_path),
    }


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

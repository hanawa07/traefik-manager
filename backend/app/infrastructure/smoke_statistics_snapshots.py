import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.infrastructure.smoke_workflow_runs import parse_run_timestamp

SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX = "dashboard_smoke_statistics_snapshot_"
SMOKE_STATISTICS_SNAPSHOT_RETENTION_DAYS = 365
_SNAPSHOT_FIELDS = (
    "total_count",
    "success_count",
    "failure_count",
    "cancelled_count",
    "skipped_count",
    "duration_run_count",
    "total_duration_seconds",
    "average_duration_seconds",
    "estimated_runner_minutes",
)


async def sync_smoke_statistics_snapshots(
    repository: Any,
    statistics: list[dict[str, Any]],
    *,
    checked_at: str | None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    reference_date = _utc_date(now or datetime.now(timezone.utc))
    cutoff = reference_date - timedelta(
        days=SMOKE_STATISTICS_SNAPSHOT_RETENTION_DAYS - 1
    )
    values = await repository.get_all_dict()
    snapshot = _build_snapshot(statistics, checked_at)
    if snapshot and date.fromisoformat(snapshot["captured_on"]) >= cutoff:
        key = _snapshot_key(snapshot["captured_on"])
        encoded = json.dumps(snapshot, ensure_ascii=True, separators=(",", ":"))
        if values.get(key) != encoded:
            await repository.set(key, encoded)
            values[key] = encoded

    retained = []
    for key, raw_value in values.items():
        if not key.startswith(SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX):
            continue
        key_date = _snapshot_date_from_key(key)
        if key_date is not None and key_date < cutoff:
            await repository.delete(key)
            continue
        parsed = _parse_snapshot(raw_value)
        if parsed is None:
            continue
        if date.fromisoformat(parsed["captured_on"]) < cutoff:
            await repository.delete(key)
            continue
        retained.append(parsed)
    return sorted(retained, key=lambda item: item["captured_on"], reverse=True)


def _build_snapshot(
    statistics: list[dict[str, Any]],
    checked_at: str | None,
) -> dict[str, Any] | None:
    captured_at = parse_run_timestamp(checked_at or "")
    statistic = next(
        (item for item in statistics if item.get("window_days") == 30),
        None,
    )
    if captured_at is None or statistic is None:
        return None
    snapshot = {
        "captured_on": captured_at.date().isoformat(),
        "window_days": 30,
        **{field: statistic.get(field) for field in _SNAPSHOT_FIELDS},
    }
    return _validate_snapshot(snapshot)


def _parse_snapshot(raw_value: str) -> dict[str, Any] | None:
    try:
        payload = json.loads(raw_value)
    except (json.JSONDecodeError, TypeError):
        return None
    return _validate_snapshot(payload)


def _validate_snapshot(payload: object) -> dict[str, Any] | None:
    if not isinstance(payload, dict) or payload.get("window_days") != 30:
        return None
    captured_on = payload.get("captured_on")
    if not isinstance(captured_on, str):
        return None
    try:
        date.fromisoformat(captured_on)
    except ValueError:
        return None
    if any(
        type(payload.get(field)) is not int or payload[field] < 0
        for field in _SNAPSHOT_FIELDS
    ):
        return None
    return {
        "captured_on": captured_on,
        "window_days": 30,
        **{field: payload[field] for field in _SNAPSHOT_FIELDS},
    }


def _snapshot_key(captured_on: str) -> str:
    return f"{SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX}{captured_on.replace('-', '')}"


def _snapshot_date_from_key(key: str) -> date | None:
    suffix = key.removeprefix(SMOKE_STATISTICS_SNAPSHOT_KEY_PREFIX)
    try:
        return datetime.strptime(suffix, "%Y%m%d").date()
    except ValueError:
        return None


def _utc_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date()

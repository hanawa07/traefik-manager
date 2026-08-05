import json
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

SMOKE_FAILURE_METADATA_KEY = "dashboard_smoke_failure_metadata"
SMOKE_FAILURE_METADATA_LIMIT = 20
SMOKE_FAILURE_TYPES = ("login", "external_api", "visual_regression")
SMOKE_FAILURE_CATEGORIES = (*SMOKE_FAILURE_TYPES, "unclassified")
SMOKE_FAILURE_INCREASE_MIN_COUNT = 2


async def record_smoke_failure_metadata(
    repo: Any,
    *,
    run_id: int,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    entry = _normalize_entry({"run_id": run_id, **metadata})
    if entry is None:
        raise ValueError("invalid smoke failure metadata")
    entries = await _read_entries(repo)
    entries = [entry, *(item for item in entries if item["run_id"] != run_id)]
    await repo.set(
        SMOKE_FAILURE_METADATA_KEY,
        json.dumps(entries[:SMOKE_FAILURE_METADATA_LIMIT], ensure_ascii=False),
    )
    return entry


async def read_smoke_failure_metadata(repo: Any) -> dict[int, dict[str, Any]]:
    return {entry["run_id"]: entry for entry in await _read_entries(repo)}


def attach_smoke_failure_metadata(
    history: dict[str, Any],
    metadata_by_run_id: dict[int, dict[str, Any]],
) -> None:
    runs = [*history["runs"]]
    if history["latest_failure"]:
        runs.append(history["latest_failure"])
    for run in runs:
        metadata = (
            metadata_by_run_id.get(run.get("run_id"))
            if run.get("status") == "failure"
            else None
        )
        run["failure_metadata"] = (
            {key: value for key, value in metadata.items() if key != "run_id"}
            if metadata
            else None
        )


def attach_smoke_failure_type_statistics(
    statistics: list[dict[str, Any]],
    failure_runs_by_window: dict[object, object],
    metadata_by_run_id: dict[int, dict[str, Any]],
    *,
    timezone_name: str,
) -> None:
    timezone = _timezone(timezone_name)
    normalized_by_window = {
        days: _normalize_failure_runs(
            failure_runs_by_window.get(
                days,
                failure_runs_by_window.get(str(days), []),
            ),
            metadata_by_run_id,
            timezone,
        )
        for days in (7, 14, 30)
    }
    increase_alerts = _build_failure_increase_alerts(normalized_by_window)
    for statistic in statistics:
        window_days = statistic.get("window_days")
        runs = normalized_by_window.get(window_days, [])
        counts = {category: 0 for category in SMOKE_FAILURE_CATEGORIES}
        daily: dict[str, dict[str, int]] = {}
        for run in runs:
            category = run["failure_type"]
            counts[category] += 1
            point = daily.setdefault(
                run["occurred_on"],
                {name: 0 for name in SMOKE_FAILURE_CATEGORIES},
            )
            point[category] += 1
        failure_count = statistic.get("failure_count")
        total_failures = failure_count if isinstance(failure_count, int) else len(runs)
        counts["unclassified"] += max(total_failures - len(runs), 0)
        statistic["failure_type_counts"] = counts
        statistic["failure_type_daily"] = [
            {"captured_on": captured_on, **daily[captured_on]}
            for captured_on in sorted(daily)
        ]
        statistic["failure_type_runs"] = runs
        statistic["failure_type_increase_alerts"] = increase_alerts


def build_smoke_failure_type_increase_alerts(
    metadata_by_run_id: dict[int, dict[str, Any]],
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)
    recent_cutoff = current - timedelta(days=7)
    previous_cutoff = current - timedelta(days=14)
    counts = {
        category: {"recent": 0, "previous": 0}
        for category in SMOKE_FAILURE_TYPES
    }
    for metadata in metadata_by_run_id.values():
        category = metadata.get("failure_type")
        captured_at = _aware_datetime(metadata.get("captured_at"))
        if category not in counts or captured_at is None or captured_at > current:
            continue
        captured_at = captured_at.astimezone(timezone.utc)
        if captured_at >= recent_cutoff:
            counts[category]["recent"] += 1
        elif captured_at >= previous_cutoff:
            counts[category]["previous"] += 1
    return [
        {
            "failure_type": category,
            "recent_count": values["recent"],
            "previous_count": values["previous"],
        }
        for category, values in counts.items()
        if values["recent"] >= SMOKE_FAILURE_INCREASE_MIN_COUNT
        and values["recent"] > values["previous"]
    ]


def _normalize_failure_runs(
    raw_runs: object,
    metadata_by_run_id: dict[int, dict[str, Any]],
    timezone: ZoneInfo,
) -> list[dict[str, Any]]:
    if not isinstance(raw_runs, list):
        return []
    normalized = []
    for raw_run in raw_runs:
        if not isinstance(raw_run, dict):
            continue
        run_id = raw_run.get("run_id")
        if not isinstance(run_id, int) or isinstance(run_id, bool) or run_id < 1:
            continue
        run_url = _required_text(raw_run.get("run_url"), 1000)
        completed_at = _required_text(raw_run.get("completed_at"), 64)
        if not run_url or not completed_at:
            continue
        metadata = metadata_by_run_id.get(run_id)
        category = metadata["failure_type"] if metadata else "unclassified"
        occurred_on = (
            _captured_on(metadata.get("captured_at"), timezone)
            if metadata
            else None
        ) or _captured_on(completed_at, timezone)
        if not occurred_on:
            continue
        run_number = raw_run.get("run_number")
        normalized.append(
            {
                "run_id": run_id,
                "run_number": (
                    run_number
                    if isinstance(run_number, int) and not isinstance(run_number, bool)
                    else None
                ),
                "run_url": run_url,
                "completed_at": completed_at,
                "occurred_on": occurred_on,
                "failure_type": category,
            }
        )
    return normalized


def _build_failure_increase_alerts(
    runs_by_window: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    recent_runs = runs_by_window[7]
    recent_ids = {run["run_id"] for run in recent_runs}
    previous_runs = [
        run for run in runs_by_window[14] if run["run_id"] not in recent_ids
    ]
    alerts = []
    for category in SMOKE_FAILURE_CATEGORIES:
        recent_count = sum(run["failure_type"] == category for run in recent_runs)
        previous_count = sum(run["failure_type"] == category for run in previous_runs)
        if (
            recent_count >= SMOKE_FAILURE_INCREASE_MIN_COUNT
            and recent_count > previous_count
        ):
            alerts.append(
                {
                    "failure_type": category,
                    "recent_count": recent_count,
                    "previous_count": previous_count,
                }
            )
    return alerts


async def _read_entries(repo: Any) -> list[dict[str, Any]]:
    raw = await repo.get(SMOKE_FAILURE_METADATA_KEY)
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(payload, list):
        return []
    return [entry for item in payload if (entry := _normalize_entry(item)) is not None]


def _normalize_entry(value: object) -> dict[str, Any] | None:
    if (
        not isinstance(value, dict)
        or not isinstance(value.get("run_id"), int)
        or isinstance(value.get("run_id"), bool)
        or value["run_id"] < 1
    ):
        return None
    captured_at = _required_text(value.get("captured_at"), 64)
    check_name = _required_text(value.get("check_name"), 500)
    if not captured_at or not check_name:
        return None
    failure_type = value.get("failure_type")
    if failure_type not in SMOKE_FAILURE_TYPES:
        failure_type = "visual_regression"
    return {
        "run_id": value["run_id"],
        "captured_at": captured_at,
        "check_name": check_name,
        "failure_type": failure_type,
        "screen_path": _optional_text(value.get("screen_path"), 500),
        "page_title": _optional_text(value.get("page_title"), 300),
    }


def _required_text(value: object, limit: int) -> str | None:
    text = str(value).strip() if isinstance(value, str) else ""
    return text[:limit] or None


def _optional_text(value: object, limit: int) -> str | None:
    return _required_text(value, limit)


def _timezone(value: str) -> ZoneInfo:
    try:
        return ZoneInfo(value)
    except (TypeError, ZoneInfoNotFoundError):
        return ZoneInfo("UTC")


def _captured_on(value: object, timezone: ZoneInfo) -> str | None:
    captured_at = _aware_datetime(value)
    if captured_at is None:
        return None
    return captured_at.astimezone(timezone).date().isoformat()


def _aware_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else None

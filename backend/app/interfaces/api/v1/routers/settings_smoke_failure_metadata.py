import json
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

SMOKE_FAILURE_METADATA_KEY = "dashboard_smoke_failure_metadata"
SMOKE_FAILURE_METADATA_LIMIT = 20
SMOKE_FAILURE_TYPES = ("login", "external_api", "visual_regression")


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
    failure_run_ids_by_window: dict[object, object],
    metadata_by_run_id: dict[int, dict[str, Any]],
    *,
    timezone_name: str,
) -> None:
    timezone = _timezone(timezone_name)
    for statistic in statistics:
        window_days = statistic.get("window_days")
        raw_run_ids = failure_run_ids_by_window.get(
            window_days,
            failure_run_ids_by_window.get(str(window_days), []),
        )
        run_ids = (
            {
                run_id
                for run_id in raw_run_ids
                if isinstance(run_id, int)
                and not isinstance(run_id, bool)
                and run_id > 0
            }
            if isinstance(raw_run_ids, list)
            else set()
        )
        counts = {failure_type: 0 for failure_type in SMOKE_FAILURE_TYPES}
        daily: dict[str, dict[str, int]] = {}
        for run_id in run_ids:
            metadata = metadata_by_run_id.get(run_id)
            if not metadata:
                continue
            failure_type = metadata["failure_type"]
            counts[failure_type] += 1
            captured_on = _captured_on(metadata.get("captured_at"), timezone)
            if captured_on:
                point = daily.setdefault(
                    captured_on,
                    {failure_type_name: 0 for failure_type_name in SMOKE_FAILURE_TYPES},
                )
                point[failure_type] += 1
        classified_count = sum(counts.values())
        failure_count = statistic.get("failure_count")
        total_failures = failure_count if isinstance(failure_count, int) else len(run_ids)
        statistic["failure_type_counts"] = {
            **counts,
            "unclassified": max(total_failures - classified_count, 0),
        }
        statistic["failure_type_daily"] = [
            {"captured_on": captured_on, **daily[captured_on]}
            for captured_on in sorted(daily)
        ]


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
    if not isinstance(value, str):
        return None
    try:
        captured_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if captured_at.tzinfo is None:
        return None
    return captured_at.astimezone(timezone).date().isoformat()

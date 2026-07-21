import json
from typing import Any

SMOKE_FAILURE_METADATA_KEY = "dashboard_smoke_failure_metadata"
SMOKE_FAILURE_METADATA_LIMIT = 20


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
    return {
        "run_id": value["run_id"],
        "captured_at": captured_at,
        "check_name": check_name,
        "screen_path": _optional_text(value.get("screen_path"), 500),
        "page_title": _optional_text(value.get("page_title"), 300),
    }


def _required_text(value: object, limit: int) -> str | None:
    text = str(value).strip() if isinstance(value, str) else ""
    return text[:limit] or None


def _optional_text(value: object, limit: int) -> str | None:
    return _required_text(value, limit)

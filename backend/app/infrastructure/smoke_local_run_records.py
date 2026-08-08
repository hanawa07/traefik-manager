import json
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from app.core.smoke_rotation_status import normalize_smoke_revision
from app.infrastructure.smoke_workflow_runs import parse_run_timestamp

SMOKE_LOCAL_RUN_KEY_PREFIX = "dashboard_smoke_local_run_"
SMOKE_LOCAL_RUN_RETENTION_DAYS = 365
SMOKE_LOCAL_RUN_DISPLAY_LIMIT = 20
SmokeRunSource = Literal["github", "host"]


async def record_smoke_host_run(
    repository: Any,
    *,
    status: Literal["success", "failure"],
    started_at: datetime,
    completed_at: datetime,
    revision: str | None = None,
    detail: str | None = None,
) -> dict[str, Any]:
    completed = _as_utc(completed_at)
    return await record_smoke_local_run(
        repository,
        run_id=int(completed.timestamp() * 1_000_000),
        status=status,
        started_at=started_at,
        completed_at=completed,
        admin_checked=True,
        source="host",
        revision=revision,
        detail=detail,
    )


async def record_smoke_local_run(
    repository: Any,
    *,
    run_id: int,
    status: Literal["success", "failure"],
    started_at: datetime | None,
    completed_at: datetime,
    admin_checked: bool = False,
    source: SmokeRunSource = "github",
    revision: str | None = None,
    detail: str | None = None,
) -> dict[str, Any]:
    completed = _as_utc(completed_at)
    started = _as_utc(started_at) if started_at else None
    safe_revision = normalize_smoke_revision(revision) if isinstance(revision, str) else None
    if revision and safe_revision is None:
        raise ValueError("배포 커밋 형식이 올바르지 않습니다")
    duration_seconds = (
        max(0, round((completed - started).total_seconds())) if started else None
    )
    record = {
        "run_id": run_id,
        "status": status,
        "started_at": started.isoformat() if started else None,
        "completed_at": completed.isoformat(),
        "duration_seconds": duration_seconds,
        "admin_checked": admin_checked,
        "source": source,
        "revision": safe_revision,
        "detail": (detail or "").strip()[:200] or None,
    }
    await repository.set(
        f"{SMOKE_LOCAL_RUN_KEY_PREFIX}{run_id}",
        json.dumps(record, ensure_ascii=True, separators=(",", ":")),
    )
    await _remove_expired_records(repository, completed)
    return record


async def read_smoke_local_runs(
    repository: Any,
    *,
    now: datetime | None = None,
    source: SmokeRunSource = "github",
) -> tuple[list[dict[str, Any]], int]:
    reference = _as_utc(now or datetime.now(timezone.utc))
    cutoff = reference - timedelta(days=SMOKE_LOCAL_RUN_RETENTION_DAYS)
    records = []
    for key, raw_value in (await repository.get_all_dict()).items():
        if not key.startswith(SMOKE_LOCAL_RUN_KEY_PREFIX):
            continue
        record = _parse_record(raw_value, key)
        if record is None:
            continue
        if record["source"] != source:
            continue
        completed_at = parse_run_timestamp(record["completed_at"])
        if completed_at is None or completed_at < cutoff:
            continue
        records.append(record)
    records.sort(key=lambda item: item["completed_at"], reverse=True)
    return records[:SMOKE_LOCAL_RUN_DISPLAY_LIMIT], len(records)


async def _remove_expired_records(repository: Any, now: datetime) -> None:
    cutoff = now - timedelta(days=SMOKE_LOCAL_RUN_RETENTION_DAYS)
    for key, raw_value in (await repository.get_all_dict()).items():
        if not key.startswith(SMOKE_LOCAL_RUN_KEY_PREFIX):
            continue
        record = _parse_record(raw_value, key)
        completed_at = (
            parse_run_timestamp(record["completed_at"]) if record is not None else None
        )
        if completed_at is not None and completed_at < cutoff:
            await repository.delete(key)


def _parse_record(raw_value: str, key: str) -> dict[str, Any] | None:
    try:
        payload = json.loads(raw_value)
        key_run_id = int(key.removeprefix(SMOKE_LOCAL_RUN_KEY_PREFIX))
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    run_id = payload.get("run_id")
    status = payload.get("status")
    started_at = payload.get("started_at")
    completed_at = payload.get("completed_at")
    duration_seconds = payload.get("duration_seconds")
    admin_checked = payload.get("admin_checked")
    source = payload.get("source", "github")
    revision = payload.get("revision")
    detail = payload.get("detail")
    safe_revision = normalize_smoke_revision(revision) if isinstance(revision, str) else None
    if (
        type(run_id) is not int
        or run_id < 1
        or run_id != key_run_id
        or not isinstance(status, str)
        or status not in {"success", "failure"}
        or not isinstance(completed_at, str)
        or parse_run_timestamp(completed_at) is None
        or (started_at is not None and not isinstance(started_at, str))
        or (isinstance(started_at, str) and parse_run_timestamp(started_at) is None)
        or (duration_seconds is not None and type(duration_seconds) is not int)
        or (isinstance(duration_seconds, int) and duration_seconds < 0)
        or type(admin_checked) is not bool
        or not isinstance(source, str)
        or source not in {"github", "host"}
        or (revision is not None and (not isinstance(revision, str) or safe_revision is None))
        or (detail is not None and (not isinstance(detail, str) or len(detail) > 200))
    ):
        return None
    return {
        "run_id": run_id,
        "status": status,
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_seconds": duration_seconds,
        "admin_checked": admin_checked,
        "source": source,
        "revision": safe_revision,
        "detail": detail,
    }


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

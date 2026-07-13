import asyncio
import gzip
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)

AUDIT_RETENTION_DAYS_KEY = "audit_retention_days"
AUDIT_ARCHIVE_ENABLED_KEY = "audit_archive_enabled"
AUDIT_RETENTION_LAST_RUN_KEY = "audit_retention_last_run_at"
AUDIT_RETENTION_LAST_ARCHIVED_KEY = "audit_retention_last_archived_count"
AUDIT_RETENTION_LAST_DELETED_KEY = "audit_retention_last_deleted_count"
AUDIT_RETENTION_LAST_FILE_KEY = "audit_retention_last_archive_file"
DEFAULT_RETENTION_DAYS = 365
AUDIT_RETENTION_BATCH_SIZE = 500
AUDIT_RETENTION_INTERVAL_SECONDS = 24 * 60 * 60
_cleanup_lock = asyncio.Lock()


@dataclass(frozen=True)
class AuditRetentionPolicy:
    retention_days: int
    archive_enabled: bool


async def read_audit_retention_status(
    repository: SQLiteSystemSettingsRepository,
) -> dict[str, object]:
    values = await repository.get_all_dict()
    policy = _build_policy(values)
    return {
        "retention_days": policy.retention_days,
        "archive_enabled": policy.archive_enabled,
        "last_run_at": values.get(AUDIT_RETENTION_LAST_RUN_KEY),
        "last_archived_count": _parse_non_negative_int(
            values.get(AUDIT_RETENTION_LAST_ARCHIVED_KEY)
        ),
        "last_deleted_count": _parse_non_negative_int(
            values.get(AUDIT_RETENTION_LAST_DELETED_KEY)
        ),
        "last_archive_file": values.get(AUDIT_RETENTION_LAST_FILE_KEY),
    }


async def run_audit_retention_once(
    db: AsyncSession,
    *,
    archive_dir: str | Path,
    now: datetime | None = None,
) -> dict[str, object]:
    async with _cleanup_lock:
        repository = SQLiteSystemSettingsRepository(db)
        values = await repository.get_all_dict()
        policy = _build_policy(values)
        run_at = _to_utc(now)
        cutoff = (run_at - timedelta(days=policy.retention_days)).replace(tzinfo=None)
        archived_count = 0
        deleted_count = 0
        last_archive_file: str | None = None

        while True:
            result = await db.execute(
                select(AuditLogModel)
                .where(AuditLogModel.created_at < cutoff)
                .order_by(AuditLogModel.created_at, AuditLogModel.id)
                .limit(AUDIT_RETENTION_BATCH_SIZE)
            )
            logs = list(result.scalars().all())
            if not logs:
                break

            if policy.archive_enabled:
                archive_path = await asyncio.to_thread(
                    _write_archive,
                    [_serialize_log(log) for log in logs],
                    Path(archive_dir),
                    run_at,
                )
                archived_count += len(logs)
                last_archive_file = archive_path.name

            await db.execute(
                delete(AuditLogModel).where(
                    AuditLogModel.id.in_([log.id for log in logs])
                )
            )
            await db.commit()
            deleted_count += len(logs)

        await repository.set(AUDIT_RETENTION_LAST_RUN_KEY, run_at.isoformat())
        await repository.set(AUDIT_RETENTION_LAST_ARCHIVED_KEY, str(archived_count))
        await repository.set(AUDIT_RETENTION_LAST_DELETED_KEY, str(deleted_count))
        await repository.set(AUDIT_RETENTION_LAST_FILE_KEY, last_archive_file)
        await db.commit()
        return await read_audit_retention_status(repository)


async def run_periodic_audit_retention(interval_seconds: int, cleanup_once) -> None:
    while True:
        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            return
        await cleanup_once()


def _build_policy(values: dict[str, str]) -> AuditRetentionPolicy:
    retention_days = _parse_non_negative_int(values.get(AUDIT_RETENTION_DAYS_KEY))
    if not 30 <= retention_days <= 3650:
        retention_days = DEFAULT_RETENTION_DAYS
    archive_enabled = values.get(AUDIT_ARCHIVE_ENABLED_KEY, "true").lower() == "true"
    return AuditRetentionPolicy(retention_days, archive_enabled)


def _write_archive(
    records: list[dict[str, object]],
    archive_dir: Path,
    run_at: datetime,
) -> Path:
    archive_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    filename = f"audit-{run_at:%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.jsonl.gz"
    target = archive_dir / filename
    with tempfile.NamedTemporaryFile(dir=archive_dir, prefix=".audit-", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with gzip.open(temporary_path, "wt", encoding="utf-8") as archive:
            for record in records:
                archive.write(
                    json.dumps(record, ensure_ascii=False, separators=(",", ":"))
                )
                archive.write("\n")
        os.chmod(temporary_path, 0o600)
        os.replace(temporary_path, target)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return target


def _serialize_log(log: AuditLogModel) -> dict[str, object]:
    created_at = log.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "id": log.id,
        "actor": log.actor,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "resource_name": log.resource_name,
        "detail": log.detail,
        "created_at": created_at.astimezone(timezone.utc).isoformat(),
    }


def _to_utc(value: datetime | None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _parse_non_negative_int(value: object) -> int:
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        return 0
    return max(parsed, 0)

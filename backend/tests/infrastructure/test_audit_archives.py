import gzip
import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.audit_archives import (
    AuditArchiveValidationError,
    list_audit_archives,
    resolve_audit_archive_path,
    restore_audit_archive,
)
from app.infrastructure.persistence.models import AuditLogModel


def _archive_record(record_id: str, resource_name: str) -> dict[str, object]:
    return {
        "id": record_id,
        "actor": "admin",
        "action": "update",
        "resource_type": "service",
        "resource_id": "service-id",
        "resource_name": resource_name,
        "detail": {"event": "service_update"},
        "created_at": "2026-07-01T03:00:00+00:00",
    }


def _write_archive(path, records: list[object]) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as archive:
        for record in records:
            archive.write(json.dumps(record))
            archive.write("\n")


@pytest.mark.asyncio
async def test_audit_archive_lists_and_restores_without_overwriting_existing_log(tmp_path):
    filename = "audit-20260714T010203Z-1234abcd.jsonl.gz"
    archive_path = tmp_path / filename
    existing_id = str(uuid4())
    restored_id = str(uuid4())
    restored_record = _archive_record(restored_id, "restored")
    restored_record["resource_id"] = "long-certificate-domain." + "x" * 40
    _write_archive(
        archive_path,
        [
            _archive_record(existing_id, "existing archive value"),
            restored_record,
        ],
    )

    archives = list_audit_archives(tmp_path)
    assert archives[0]["filename"] == filename
    assert archives[0]["size_bytes"] == archive_path.stat().st_size
    assert archives[0]["modified_at"].tzinfo == timezone.utc

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        db.add(
            AuditLogModel(
                id=existing_id,
                actor="original",
                action="create",
                resource_type="service",
                resource_id="service-id",
                resource_name="existing database value",
                created_at=datetime(2026, 7, 2),
            )
        )
        await db.commit()
        result = await restore_audit_archive(
            db,
            archive_dir=tmp_path,
            filename=filename,
        )
        await db.commit()
        logs = list(
            (
                await db.execute(
                    select(AuditLogModel).order_by(AuditLogModel.resource_name)
                )
            )
            .scalars()
            .all()
        )

    await engine.dispose()
    assert result == {
        "filename": filename,
        "total_count": 2,
        "restored_count": 1,
        "skipped_count": 1,
    }
    assert [log.resource_name for log in logs] == ["existing database value", "restored"]


@pytest.mark.asyncio
async def test_audit_archive_rejects_malformed_file_before_database_change(tmp_path):
    filename = "audit-20260714T010203Z-deadbeef.jsonl.gz"
    _write_archive(
        tmp_path / filename,
        [
            _archive_record(str(uuid4()), "valid"),
            {"id": "not-a-uuid"},
        ],
    )
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        with pytest.raises(AuditArchiveValidationError, match="UUID"):
            await restore_audit_archive(
                db,
                archive_dir=tmp_path,
                filename=filename,
            )
        logs = list((await db.execute(select(AuditLogModel))).scalars().all())

    await engine.dispose()
    assert logs == []


def test_audit_archive_path_rejects_non_generated_filename(tmp_path):
    with pytest.raises(FileNotFoundError):
        resolve_audit_archive_path(tmp_path, "../audit.jsonl.gz")

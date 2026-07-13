import gzip
import json
from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.audit_retention import (
    AUDIT_ARCHIVE_ENABLED_KEY,
    AUDIT_RETENTION_DAYS_KEY,
    run_audit_retention_once,
)
from app.infrastructure.persistence.models import AuditLogModel, SystemSettingModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_audit_retention_archives_then_deletes_expired_logs(tmp_path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
        await connection.run_sync(SystemSettingModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        repository = SQLiteSystemSettingsRepository(db)
        await repository.set(AUDIT_RETENTION_DAYS_KEY, "30")
        await repository.set(AUDIT_ARCHIVE_ENABLED_KEY, "true")
        db.add_all(
            [
                make_log(resource_name="expired", created_at=datetime(2026, 5, 1)),
                make_log(resource_name="active", created_at=datetime(2026, 7, 1)),
            ]
        )
        await db.commit()

        status = await run_audit_retention_once(
            db,
            archive_dir=tmp_path,
            now=datetime(2026, 7, 14, tzinfo=timezone.utc),
        )
        remaining = list((await db.execute(select(AuditLogModel))).scalars().all())

    await engine.dispose()
    archives = list(tmp_path.glob("*.jsonl.gz"))
    assert [log.resource_name for log in remaining] == ["active"]
    assert status["last_archived_count"] == 1
    assert status["last_deleted_count"] == 1
    assert status["last_archive_file"] == archives[0].name
    assert archives[0].stat().st_mode & 0o777 == 0o600
    with gzip.open(archives[0], "rt", encoding="utf-8") as archive:
        archived = json.loads(archive.readline())
    assert archived["resource_name"] == "expired"


@pytest.mark.asyncio
async def test_audit_retention_can_delete_without_archive(tmp_path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
        await connection.run_sync(SystemSettingModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        repository = SQLiteSystemSettingsRepository(db)
        await repository.set(AUDIT_RETENTION_DAYS_KEY, "30")
        await repository.set(AUDIT_ARCHIVE_ENABLED_KEY, "false")
        db.add(make_log(resource_name="expired", created_at=datetime(2026, 5, 1)))
        await db.commit()
        status = await run_audit_retention_once(
            db,
            archive_dir=tmp_path,
            now=datetime(2026, 7, 14, tzinfo=timezone.utc),
        )

    await engine.dispose()
    assert status["last_archived_count"] == 0
    assert status["last_deleted_count"] == 1
    assert list(tmp_path.iterdir()) == []

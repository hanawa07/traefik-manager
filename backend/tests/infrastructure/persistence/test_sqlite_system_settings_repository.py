import asyncio

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import SystemSettingModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)


@pytest.mark.asyncio
async def test_set_upserts_same_new_key_from_concurrent_sessions(tmp_path) -> None:
    database_path = tmp_path / "settings.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{database_path}",
        connect_args={"timeout": 2},
    )
    async with engine.begin() as connection:
        await connection.run_sync(SystemSettingModel.__table__.create)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    release_commit = asyncio.Event()
    both_sets_returned = asyncio.Event()
    returned_count = 0

    async def write_value(value: str) -> None:
        nonlocal returned_count
        async with session_factory() as session:
            repository = SQLiteSystemSettingsRepository(session)
            await repository.set("shared-key", value)
            returned_count += 1
            if returned_count == 2:
                both_sets_returned.set()
            await release_commit.wait()
            await session.commit()

    tasks = [
        asyncio.create_task(write_value("first")),
        asyncio.create_task(write_value("second")),
    ]
    try:
        try:
            await asyncio.wait_for(both_sets_returned.wait(), timeout=0.2)
        except TimeoutError:
            pass
    finally:
        release_commit.set()

    await asyncio.gather(*tasks)

    async with session_factory() as session:
        row_count = await session.scalar(
            select(func.count()).select_from(SystemSettingModel)
        )
        value = await session.scalar(
            select(SystemSettingModel.value).where(
                SystemSettingModel.key == "shared-key"
            )
        )

    assert row_count == 1
    assert value in {"first", "second"}
    await engine.dispose()

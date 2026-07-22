from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.audit_github_api_rate_limit_summary import (
    load_github_api_rate_limit_summary,
)
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_github_api_rate_limit_summary_aggregates_fixed_and_custom_periods() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)

    async with session_factory() as db:
        db.add_all(
            [
                make_log(event="github_api_primary_rate_limit", created_at=now - timedelta(hours=2)),
                make_log(event="github_api_secondary_rate_limit", created_at=now - timedelta(days=3)),
                make_log(event="github_api_primary_rate_limit", created_at=now - timedelta(days=20)),
                make_log(event="github_api_secondary_rate_limit", created_at=now - timedelta(days=60)),
                make_log(event="github_api_primary_rate_limit", created_at=now - timedelta(days=120)),
                make_log(event="service_update", created_at=now - timedelta(hours=1)),
            ]
        )
        await db.commit()
        result = await load_github_api_rate_limit_summary(
            db,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 7, 22),
            now=now,
        )

    await engine.dispose()
    assert [(item.days, item.primary, item.secondary) for item in result.periods] == [
        (1, 1, 0),
        (7, 1, 1),
        (30, 2, 1),
        (90, 2, 2),
    ]
    assert result.custom is not None
    assert (result.custom.primary, result.custom.secondary) == (2, 1)


@pytest.mark.asyncio
async def test_github_api_rate_limit_summary_returns_zero_without_events() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        result = await load_github_api_rate_limit_summary(
            db,
            now=datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc),
        )

    await engine.dispose()
    assert all((item.primary, item.secondary) == (0, 0) for item in result.periods)
    assert result.custom is None

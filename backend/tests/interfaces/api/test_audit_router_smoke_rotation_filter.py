from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Response
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_list_audit_logs_filters_smoke_rotation_results() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)

    async with session_factory() as db:
        db.add_all(
            [
                make_log(event="smoke_rotation_succeeded", action="rotate", created_at=now),
                make_log(
                    event="smoke_rotation_failed",
                    action="rotate",
                    created_at=now - timedelta(minutes=1),
                ),
                make_log(event="user_update", action="update", created_at=now),
            ]
        )
        await db.commit()
        result = await audit_router.list_audit_logs(
            response=Response(),
            limit=10,
            offset=0,
            resource_type=None,
            action=None,
            event="smoke_rotation_result",
            manager_status=None,
            manager_source=None,
            period_days=None,
            start_date=None,
            end_date=None,
            search=None,
            security_only=False,
            provider=None,
            delivery_success=None,
            db=db,
            _={"username": "admin"},
        )

    await engine.dispose()
    assert {item.event for item in result} == {
        "smoke_rotation_failed",
        "smoke_rotation_succeeded",
    }

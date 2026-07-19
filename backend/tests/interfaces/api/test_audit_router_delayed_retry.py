from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel, SystemSettingModel
from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_delayed_retry_filter_counts_before_paging_and_excludes_threshold_boundary():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
        await connection.run_sync(SystemSettingModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        first_root = make_log(
            action="alert",
            resource_type="settings",
            created_at=datetime(2026, 7, 19, 0, 0, tzinfo=timezone.utc),
        )
        first_delayed = make_log(
            action="alert",
            resource_type="settings",
            event="security_alert_delivery_failure",
            detail_extra={
                "retry_of_audit_id": str(first_root.id),
                "trigger": "automatic_retry",
            },
            created_at=datetime(2026, 7, 19, 0, 11, tzinfo=timezone.utc),
        )
        boundary_root = make_log(
            action="alert",
            resource_type="settings",
            created_at=datetime(2026, 7, 19, 1, 0, tzinfo=timezone.utc),
        )
        boundary_retry = make_log(
            action="alert",
            resource_type="settings",
            detail_extra={
                "retry_of_audit_id": str(boundary_root.id),
                "trigger": "automatic_retry",
            },
            created_at=datetime(2026, 7, 19, 1, 10, tzinfo=timezone.utc),
        )
        latest_root = make_log(
            action="alert",
            resource_type="settings",
            created_at=datetime(2026, 7, 19, 2, 0, tzinfo=timezone.utc),
        )
        latest_delayed = make_log(
            action="alert",
            resource_type="settings",
            event="security_alert_delivery_success",
            detail_extra={
                "retry_of_audit_id": str(latest_root.id),
                "trigger": "automatic_retry",
            },
            created_at=datetime(2026, 7, 19, 2, 20, tzinfo=timezone.utc),
        )
        db.add_all(
            [first_root, first_delayed, boundary_root, boundary_retry, latest_root, latest_delayed]
        )
        await db.commit()

        app = FastAPI()
        app.include_router(audit_router.router, prefix="/audit")
        app.dependency_overrides[audit_router.get_db] = lambda: db
        app.dependency_overrides[audit_router.get_current_user] = lambda: {"username": "admin"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/audit",
                params={"retry_delay": "delayed", "limit": 1, "offset": 1},
            )
            invalid = await client.get("/audit", params={"retry_delay": "slow"})

    await engine.dispose()
    assert response.status_code == 200
    assert response.headers["x-total-count"] == "2"
    assert [item["id"] for item in response.json()] == [str(first_delayed.id)]
    assert invalid.status_code == 422

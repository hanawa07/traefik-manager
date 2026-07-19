from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_list_audit_logs_filters_bulk_operation_id():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    operation_id = uuid4()
    async with session_factory() as session:
        session.add_all(
            [
                make_log(
                    resource_type="service",
                    resource_name="first",
                    created_at=datetime.now(timezone.utc),
                    detail_extra={"bulk_operation_id": str(operation_id)},
                ),
                make_log(
                    resource_type="service",
                    resource_name="other",
                    created_at=datetime.now(timezone.utc),
                    detail_extra={"bulk_operation_id": str(uuid4())},
                ),
            ]
        )
        await session.commit()

        app = FastAPI()
        app.include_router(audit_router.router, prefix="/audit")
        app.dependency_overrides[audit_router.get_db] = lambda: session
        app.dependency_overrides[audit_router.get_current_user] = lambda: {
            "username": "admin"
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/audit", params={"bulk_operation_id": str(operation_id)}
            )

    await engine.dispose()

    assert response.status_code == 200
    assert [item["resource_name"] for item in response.json()] == ["first"]

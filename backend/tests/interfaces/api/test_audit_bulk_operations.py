from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import audit_bulk_operations
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_bulk_operations_group_services_and_latest_delivery_status():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)
    ancient_operation_id = uuid4()
    older_operation_id = uuid4()
    latest_operation_id = uuid4()
    first_failure = _delivery_log(
        latest_operation_id,
        False,
        now + timedelta(milliseconds=500),
        detail="연결 시간 초과",
    )
    latest_failure = _delivery_log(
        latest_operation_id,
        False,
        now + timedelta(seconds=1),
        detail="Telegram API 응답 없음",
        retry_of_audit_id=first_failure.id,
    )
    older_failure = _delivery_log(
        older_operation_id,
        False,
        now - timedelta(seconds=90),
        detail="일시적 전송 실패",
    )
    older_success = _delivery_log(
        older_operation_id,
        True,
        now - timedelta(minutes=1),
        retry_of_audit_id=older_failure.id,
    )

    async with session_factory() as session:
        session.add_all(
            [
                _service_log(older_operation_id, "English", now - timedelta(minutes=3)),
                _service_log(older_operation_id, "Homepage", now - timedelta(minutes=2)),
                older_failure,
                older_success,
                _service_log(latest_operation_id, "Manager", now),
                first_failure,
                latest_failure,
                _service_log(ancient_operation_id, "Legacy", now - timedelta(days=10)),
            ]
        )
        await session.commit()

        app = FastAPI()
        app.include_router(audit_bulk_operations.router, prefix="/audit")
        app.dependency_overrides[audit_bulk_operations.get_db] = lambda: session
        app.dependency_overrides[audit_bulk_operations.get_current_user] = lambda: {
            "username": "admin"
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/audit/bulk-operations", params={"limit": 2})
            failure_response = await client.get(
                "/audit/bulk-operations",
                params={"notification_status": "failure", "limit": 2},
            )
            none_response = await client.get(
                "/audit/bulk-operations",
                params={"notification_status": "none", "limit": 2},
            )
            period_response = await client.get(
                "/audit/bulk-operations",
                params={"period_days": 7, "limit": 20},
            )
            invalid_period_response = await client.get(
                "/audit/bulk-operations",
                params={"period_days": 1},
            )

    await engine.dispose()

    assert response.status_code == 200
    latest_item, older_item = response.json()
    assert latest_item | {"completed_at": "ignored"} == {
        "operation_id": str(latest_operation_id),
        "actor": "admin",
        "service_count": 1,
        "service_names": ["Manager"],
        "routing_mode_after": "maintenance",
        "completed_at": "ignored",
        "notification_status": "failure",
        "notification_audit_id": str(latest_failure.id),
        "notification_provider": "telegram",
        "notification_attempt_count": 2,
        "last_failure_detail": "Telegram API 응답 없음",
    }
    assert older_item["service_names"] == ["English", "Homepage"]
    assert older_item["notification_status"] == "success"
    assert older_item["notification_attempt_count"] == 2
    assert older_item["last_failure_detail"] == "일시적 전송 실패"
    assert [item["operation_id"] for item in failure_response.json()] == [
        str(latest_operation_id)
    ]
    assert [item["operation_id"] for item in none_response.json()] == [
        str(ancient_operation_id)
    ]
    assert len(period_response.json()) == 2
    assert invalid_period_response.status_code == 422


def _service_log(operation_id, service_name: str, created_at: datetime):
    return make_log(
        actor="admin",
        action="update",
        resource_type="service",
        resource_name=service_name,
        event="service_update",
        created_at=created_at,
        detail_extra={
            "bulk_operation_id": str(operation_id),
            "before": {"routing_mode": "active"},
            "after": {"routing_mode": "maintenance"},
        },
    )


def _delivery_log(
    operation_id,
    success: bool,
    created_at: datetime,
    *,
    detail: str | None = None,
    retry_of_audit_id=None,
):
    detail_extra = {
        "success": success,
        "provider": "telegram",
        "source_event": "service_update",
        "source_resource_type": "service",
        "source_resource_id": str(operation_id),
    }
    if detail:
        detail_extra["detail"] = detail
    if retry_of_audit_id:
        detail_extra["retry_of_audit_id"] = str(retry_of_audit_id)
    return make_log(
        actor="system",
        action="alert",
        resource_type="settings",
        resource_name="운영 변경 알림 전송 결과",
        event=f"change_alert_delivery_{'success' if success else 'failure'}",
        created_at=created_at,
        detail_extra=detail_extra,
    )

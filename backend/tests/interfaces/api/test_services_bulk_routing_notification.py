from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.notifications.security_alert_payloads import (
    build_telegram_message,
)
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers import services_bulk_routing_notification
from tests.interfaces.api.audit_router_fakes import make_log


@pytest.mark.asyncio
async def test_bulk_routing_notification_aggregates_once(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    operation_id = uuid4()
    notifications = []

    async def fake_notify(db, audit_log):
        notifications.append(audit_log)
        db.add(
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="운영 변경 알림 전송 결과",
                created_at=datetime.now(timezone.utc),
                detail_extra={
                    "event": "change_alert_delivery_success",
                    "success": True,
                    "source_event": "service_update",
                    "source_resource_id": str(operation_id),
                    "source_resource_name": "2개 서비스",
                },
            )
        )
        await db.flush()
        return True

    monkeypatch.setattr(
        services_bulk_routing_notification.security_alert_notifier,
        "notify_if_needed",
        fake_notify,
    )

    async with session_factory() as db:
        db.add_all(
            [
                make_log(
                    actor="admin",
                    resource_type="service",
                    resource_name="English",
                    event="service_update",
                    created_at=datetime.now(timezone.utc),
                    detail_extra={"bulk_operation_id": str(operation_id)},
                ),
                make_log(
                    actor="admin",
                    resource_type="service",
                    resource_name="Homepage",
                    event="service_update",
                    created_at=datetime.now(timezone.utc),
                    detail_extra={"bulk_operation_id": str(operation_id)},
                ),
            ]
        )
        await db.commit()

        first = await services_bulk_routing_notification.complete_bulk_routing_notification_action(
            operation_id=operation_id,
            db=db,
        )
        second = await services_bulk_routing_notification.complete_bulk_routing_notification_action(
            operation_id=operation_id,
            db=db,
        )

    await engine.dispose()

    assert first.service_count == 2
    assert first.notification_sent is True
    assert first.already_processed is False
    assert second.already_processed is True
    assert len(notifications) == 1
    assert notifications[0].resource_name == "2개 서비스"
    assert notifications[0].detail["bulk_service_names"] == ["English", "Homepage"]
    message = build_telegram_message(notifications[0], "service_update", "change")
    assert "서비스: English, Homepage" in message
    assert f"일괄 작업 ID: {operation_id}" in message

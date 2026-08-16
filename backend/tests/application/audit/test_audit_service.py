from contextlib import nullcontext
from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application.audit import audit_service
from app.infrastructure.persistence.models import AuditLogModel


class StubDbSession:
    def __init__(self):
        self.added = []
        self.flushed = False
        self.no_autoflush = nullcontext()

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushed = True


@pytest.mark.asyncio
async def test_record_defers_flush_until_notification_finishes(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AuditLogModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    pending_states: list[bool] = []

    async def fake_notify_if_needed(db_session, audit_log):
        assert audit_log.created_at is not None
        pending_states.append(audit_log in db_session.new)
        await db_session.execute(select(AuditLogModel.id))
        pending_states.append(audit_log in db_session.new)
        return True

    monkeypatch.setattr(audit_service.security_alert_notifier, "notify_if_needed", fake_notify_if_needed)

    async with session_factory() as db:
        await audit_service.record(
            db=db,
            actor="system",
            action="alert",
            resource_type="manager_component",
            resource_id="backend-api",
            resource_name="Manager API",
            detail={"event": "manager_http_errors_high"},
        )
        await db.commit()

    await engine.dispose()

    assert pending_states == [True, True]


@pytest.mark.asyncio
async def test_record_triggers_security_alert_notifier_for_recorded_log(monkeypatch):
    db = StubDbSession()
    notified = []

    async def fake_notify_if_needed(db_session, audit_log):
        notified.append((db_session, audit_log))
        return True

    monkeypatch.setattr(audit_service.security_alert_notifier, "notify_if_needed", fake_notify_if_needed)

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id="abc",
        resource_name="alice",
        detail={"event": "login_suspicious", "client_ip": "1.2.3.4"},
    )

    assert db.flushed is True
    assert len(db.added) == 1
    assert notified[0][0] is db
    assert notified[0][1].detail["event"] == "login_suspicious"


@pytest.mark.asyncio
async def test_record_can_skip_notification(monkeypatch):
    db = StubDbSession()
    notified = []

    async def fake_notify_if_needed(db_session, audit_log):
        notified.append((db_session, audit_log))
        return True

    monkeypatch.setattr(audit_service.security_alert_notifier, "notify_if_needed", fake_notify_if_needed)

    await audit_service.record(
        db=db,
        actor="admin",
        action="update",
        resource_type="service",
        resource_id="abc",
        resource_name="service",
        detail={"event": "service_update"},
        notify=False,
    )

    assert db.flushed is True
    assert notified == []

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.maintenance_expiry_monitor import (
    transition_expired_maintenance_services_once,
)


class StubFileWriter:
    def __init__(self):
        self.written = []

    def write(self, service, middleware_templates=None):
        self.written.append((service.name, service.routing_mode, middleware_templates))


@pytest.mark.asyncio
async def test_expired_maintenance_service_returns_to_active(make_service):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(ServiceModel.__table__.create)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime(2030, 1, 2, 3, 4, tzinfo=timezone.utc)
    writer = StubFileWriter()
    audits = []

    async def fake_audit_recorder(**kwargs):
        audits.append(kwargs)

    async with session_factory() as session:
        repository = SQLiteServiceRepository(session)
        await repository.save(
            make_service(
                name="expired",
                domain="expired.example.com",
                routing_mode="maintenance",
                maintenance_until=now - timedelta(minutes=1),
            )
        )
        await repository.save(
            make_service(
                name="future",
                domain="future.example.com",
                routing_mode="maintenance",
                maintenance_until=now + timedelta(minutes=1),
            )
        )
        await session.commit()

    result = await transition_expired_maintenance_services_once(
        session_factory=session_factory,
        file_writer_factory=lambda: writer,
        audit_recorder=fake_audit_recorder,
        now=now,
    )

    async with session_factory() as session:
        services = {
            service.name: service
            for service in await SQLiteServiceRepository(session).find_all()
        }
    await engine.dispose()

    assert result["transitioned_names"] == ["expired"]
    assert services["expired"].routing_mode == "active"
    assert services["expired"].maintenance_until is None
    assert services["future"].routing_mode == "maintenance"
    assert writer.written == [("expired", "active", [])]
    assert audits[0]["actor"] == "system"
    assert audits[0]["detail"]["automatic_transition"] == "maintenance_expired"
    assert audits[0]["detail"]["rollback_payload"] == {
        "routing_mode": "maintenance",
        "maintenance_until": None,
    }

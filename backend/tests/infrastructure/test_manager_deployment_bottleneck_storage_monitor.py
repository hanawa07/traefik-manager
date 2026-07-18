from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_deployment_bottleneck_storage_monitor as monitor


class StubSettingsRepository:
    store: dict[str, str] = {}

    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str | None) -> None:
        if value is None:
            self.store.pop(key, None)
        else:
            self.store[key] = value


class StubSession:
    async def commit(self) -> None:
        return None


@asynccontextmanager
async def make_session():
    yield StubSession()


@pytest.mark.asyncio
async def test_bottleneck_storage_monitor_records_warning_once_and_recovery(monkeypatch):
    StubSettingsRepository.store = {}
    recorded: list[dict] = []
    active = True
    event_count = 84

    def read_state():
        return {
            "storage_warning_active": active,
            "storage_warning_run_url": (
                "https://github.com/hanawa07/traefik-manager/actions/runs/101"
            ) if active else None,
            "storage_warning_alerted_at": "2026-07-18T00:00:00Z" if active else None,
            "retained_event_count": event_count,
        }

    async def record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(monitor.audit_service, "record", record)

    warning = await monitor.check_manager_deployment_bottleneck_storage_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 18, 1, 0, tzinfo=timezone.utc),
    )
    repeated = await monitor.check_manager_deployment_bottleneck_storage_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 18, 1, 1, tzinfo=timezone.utc),
    )
    active = False
    event_count = 79
    recovered = await monitor.check_manager_deployment_bottleneck_storage_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 18, 1, 2, tzinfo=timezone.utc),
    )

    assert warning["event"] == "manager_deployment_bottleneck_storage_warning"
    assert repeated["event"] is None
    assert recovered["event"] == "manager_deployment_bottleneck_storage_recovered"
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_deployment_bottleneck_storage_warning",
        "manager_deployment_bottleneck_storage_recovered",
    ]
    assert recorded[0]["detail"]["event_count"] == 84
    assert recorded[1]["detail"]["event_count"] == 79
    assert recorded[1]["detail"]["previous_event_count"] == 84
    assert monitor.AUDIT_STATE_KEY not in StubSettingsRepository.store

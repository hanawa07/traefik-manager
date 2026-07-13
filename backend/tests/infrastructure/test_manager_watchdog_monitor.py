from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_watchdog_monitor


class StubSettingsRepository:
    store: dict[str, str] = {}

    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str | None) -> None:
        if value is not None:
            self.store[key] = value


class StubSession:
    async def commit(self) -> None:
        pass


@asynccontextmanager
async def make_session():
    yield StubSession()


@pytest.mark.asyncio
async def test_watchdog_staleness_records_delay_and_recovery(monkeypatch):
    StubSettingsRepository.store = {"external_watchdog_stale_minutes": "15"}
    recorded: list[dict] = []
    stale = True
    available = True

    def read_state(**_kwargs):
        return {
            "external_watchdog_stale": stale,
            "external_watchdog_status": "healthy" if available else "unknown",
            "external_watchdog_checked_at": datetime(
                2026, 7, 13, 3, 0, tzinfo=timezone.utc
            )
            if available
            else None,
            "external_watchdog_consecutive_failures": 0,
        }

    async def record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(
        manager_watchdog_monitor,
        "SQLiteSystemSettingsRepository",
        StubSettingsRepository,
    )
    monkeypatch.setattr(manager_watchdog_monitor.audit_service, "record", record)

    delayed = await manager_watchdog_monitor.check_watchdog_staleness_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 13, 3, 20, tzinfo=timezone.utc),
    )
    available = False
    unknown = await manager_watchdog_monitor.check_watchdog_staleness_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 13, 3, 20, 30, tzinfo=timezone.utc),
    )
    available = True
    repeated = await manager_watchdog_monitor.check_watchdog_staleness_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 13, 3, 21, tzinfo=timezone.utc),
    )
    stale = False
    recovered = await manager_watchdog_monitor.check_watchdog_staleness_once(
        session_factory=make_session,
        state_reader=read_state,
        now=datetime(2026, 7, 13, 3, 22, tzinfo=timezone.utc),
    )

    assert delayed["event"] == "manager_watchdog_stale"
    assert unknown["status"] == "unknown"
    assert unknown["event"] is None
    assert repeated["event"] is None
    assert recovered["event"] == "manager_watchdog_recovered"
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_watchdog_stale",
        "manager_watchdog_recovered",
    ]
    assert recorded[0]["detail"]["stale_after_minutes"] == 15

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_settings_history_latency_monitor as monitor


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


class StubLatencyReader:
    summary: dict[str, object] = {}


async def read_stub_latency(**_kwargs) -> dict[str, object]:
    return StubLatencyReader.summary


def _summary(*, p95_ms: float) -> dict[str, object]:
    return {
        "available": True,
        "ready": True,
        "breached": p95_ms > monitor.SETTINGS_HISTORY_LATENCY_THRESHOLD_MS,
        "sample_count": 10,
        "p95_ms": p95_ms,
    }


def _patch_dependencies(monkeypatch, recorded: list[dict]) -> None:
    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(monitor.audit_service, "record", fake_record, raising=False)


@pytest.mark.asyncio
async def test_settings_history_latency_alerts_cools_down_and_recovers(monkeypatch):
    StubSettingsRepository.store = {
        "manager_health_monitoring_enabled": "true",
        "manager_health_alert_cooldown_minutes": "60",
    }
    StubLatencyReader.summary = _summary(p95_ms=800)
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    first = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 1, 0, tzinfo=timezone.utc),
        minimum_interval_seconds=0,
    )
    StubLatencyReader.summary = {
        "available": True,
        "ready": False,
        "breached": False,
        "sample_count": 1,
        "p95_ms": 800,
    }
    sampling = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 1, 5, tzinfo=timezone.utc),
        minimum_interval_seconds=0,
    )
    StubLatencyReader.summary = _summary(p95_ms=800)
    suppressed = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 1, 10, tzinfo=timezone.utc),
        minimum_interval_seconds=0,
    )
    repeated = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 2, 1, tzinfo=timezone.utc),
        minimum_interval_seconds=0,
    )
    StubLatencyReader.summary = _summary(p95_ms=30)
    recovered = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 2, 2, tzinfo=timezone.utc),
        minimum_interval_seconds=0,
    )

    assert first["recorded_event_count"] == 1
    assert sampling["ready"] is False
    assert sampling["alert_active"] is True
    assert sampling["recorded_event_count"] == 0
    assert suppressed["suppressed_count"] == 1
    assert repeated["recorded_event_count"] == 1
    assert recovered["recorded_event_count"] == 1
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_settings_history_latency_high",
        "manager_settings_history_latency_high",
        "manager_settings_history_latency_recovered",
    ]
    assert recorded[0]["detail"]["p95_ms"] == 800
    assert recorded[0]["detail"]["threshold_ms"] == 750
    state = json.loads(
        StubSettingsRepository.store[monitor.MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY]
    )
    assert state["alert_active"] is False


@pytest.mark.asyncio
async def test_settings_history_latency_monitor_skips_frequent_log_scan(monkeypatch):
    StubSettingsRepository.store = {
        "manager_health_monitoring_enabled": "true",
        monitor.MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY: json.dumps(
            {
                "available": True,
                "ready": True,
                "checked_at": "2026-07-23T01:00:00+00:00",
                "sample_count": 10,
                "p95_ms": 30,
            }
        ),
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    async def unexpected_reader(**_kwargs):
        raise AssertionError("5분 안에는 로그를 다시 읽으면 안 됩니다")

    result = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=unexpected_reader,
        now=datetime(2026, 7, 23, 1, 1, tzinfo=timezone.utc),
    )

    assert result["p95_ms"] == 30
    assert recorded == []


@pytest.mark.asyncio
async def test_settings_history_latency_monitor_disabled_clears_state(monkeypatch):
    StubSettingsRepository.store = {
        "manager_health_monitoring_enabled": "false",
        monitor.MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY: json.dumps(
            {"alert_active": True}
        ),
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    result = await monitor.check_manager_settings_history_latency_once(
        session_factory=make_session,
        latency_reader=read_stub_latency,
        now=datetime(2026, 7, 23, 1, 0, tzinfo=timezone.utc),
    )

    assert result["enabled"] is False
    assert monitor.MANAGER_SETTINGS_HISTORY_LATENCY_STATE_KEY not in StubSettingsRepository.store
    assert recorded == []

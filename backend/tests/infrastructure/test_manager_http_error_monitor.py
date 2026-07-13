import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_http_error_monitor


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


class StubDockerClient:
    counts: dict[str, object] = {}

    async def get_manager_http_error_counts(self, **_kwargs) -> dict[str, object]:
        return self.counts


def _patch_dependencies(monkeypatch, recorded: list[dict]) -> None:
    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(
        manager_http_error_monitor,
        "SQLiteSystemSettingsRepository",
        StubSettingsRepository,
    )
    monkeypatch.setattr(
        manager_http_error_monitor.audit_service,
        "record",
        fake_record,
        raising=False,
    )


@pytest.mark.asyncio
async def test_manager_http_error_monitor_alerts_cools_down_and_recovers(monkeypatch):
    StubSettingsRepository.store = {
        "manager_http_error_monitoring_enabled": "true",
        "manager_http_error_window_minutes": "15",
        "manager_http_not_found_threshold": "2",
        "manager_http_server_error_threshold": "1",
    }
    StubDockerClient.counts = {
        "available": True,
        "not_found_count": 2,
        "server_error_count": 0,
        "top_paths": [],
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    first = await manager_http_error_monitor.check_manager_http_errors_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 18, 0, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    suppressed = await manager_http_error_monitor.check_manager_http_errors_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 18, 10, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    repeated = await manager_http_error_monitor.check_manager_http_errors_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 19, 1, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    StubDockerClient.counts = {
        "available": True,
        "not_found_count": 0,
        "server_error_count": 0,
        "top_paths": [],
    }
    recovered = await manager_http_error_monitor.check_manager_http_errors_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 19, 2, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )

    assert first["recorded_event_count"] == 1
    assert suppressed["suppressed_count"] == 1
    assert repeated["recorded_event_count"] == 1
    assert recovered["recorded_event_count"] == 1
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_http_errors_high",
        "manager_http_errors_high",
        "manager_http_errors_recovered",
    ]
    state = json.loads(
        StubSettingsRepository.store[
            manager_http_error_monitor.MANAGER_HTTP_ERROR_STATE_KEY
        ]
    )
    assert state["alert_active"] is False


@pytest.mark.asyncio
async def test_manager_http_error_monitor_disabled_clears_state(monkeypatch):
    StubSettingsRepository.store = {
        manager_http_error_monitor.MANAGER_HTTP_ERROR_STATE_KEY: json.dumps(
            {"alert_active": True}
        )
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    class UnexpectedDockerClient:
        async def get_manager_http_error_counts(self, **_kwargs):
            raise AssertionError("비활성 상태에서는 로그를 조회하면 안 됩니다")

    result = await manager_http_error_monitor.check_manager_http_errors_once(
        session_factory=make_session,
        client_factory=UnexpectedDockerClient,
        now=datetime(2026, 7, 14, 18, 0, tzinfo=timezone.utc),
    )

    assert result["enabled"] is False
    assert manager_http_error_monitor.MANAGER_HTTP_ERROR_STATE_KEY not in (
        StubSettingsRepository.store
    )
    assert recorded == []

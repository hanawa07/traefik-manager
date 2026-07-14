import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_http_log_storage_monitor


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
    storage: dict[str, object] = {}

    async def get_manager_http_log_storage(self) -> dict[str, object]:
        return self.storage


def _patch_dependencies(monkeypatch, recorded: list[dict]) -> None:
    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(
        manager_http_log_storage_monitor,
        "SQLiteSystemSettingsRepository",
        StubSettingsRepository,
    )
    monkeypatch.setattr(
        manager_http_log_storage_monitor.audit_service,
        "record",
        fake_record,
        raising=False,
    )


def test_log_storage_monitor_compares_unrounded_capacity_percent():
    detail = manager_http_log_storage_monitor._normalize_storage(
        {
            "source": "persistent",
            "size_bytes": 7_999,
            "capacity_bytes": 10_000,
        }
    )

    assert detail["usage_percent"] == 80.0
    assert detail["status"] == "healthy"


@pytest.mark.asyncio
async def test_log_storage_monitor_alerts_cools_down_changes_and_recovers(monkeypatch):
    StubSettingsRepository.store = {"manager_health_monitoring_enabled": "true"}
    StubDockerClient.storage = {
        "source": "persistent",
        "size_bytes": 800,
        "capacity_bytes": 1_000,
        "file_count": 5,
        "max_file_count": 6,
        "rotated_file_count": 4,
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    first = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 18, 0, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    suppressed = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 18, 10, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    repeated = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 19, 1, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    StubDockerClient.storage = {**StubDockerClient.storage, "source": "docker"}
    changed = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 19, 2, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    StubDockerClient.storage = {
        **StubDockerClient.storage,
        "source": "persistent",
        "size_bytes": 100,
    }
    recovered = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 14, 19, 3, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )

    assert first["status"] == "capacity"
    assert first["recorded_event_count"] == 1
    assert suppressed["suppressed_count"] == 1
    assert repeated["recorded_event_count"] == 1
    assert changed["status"] == "docker"
    assert changed["recorded_event_count"] == 1
    assert recovered["status"] == "healthy"
    assert recovered["recorded_event_count"] == 1
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_http_log_storage_warning",
        "manager_http_log_storage_warning",
        "manager_http_log_storage_warning",
        "manager_http_log_storage_recovered",
    ]
    assert [item["detail"]["status"] for item in recorded] == [
        "capacity",
        "capacity",
        "docker",
        "healthy",
    ]
    state = json.loads(
        StubSettingsRepository.store[
            manager_http_log_storage_monitor.MANAGER_HTTP_LOG_STORAGE_STATE_KEY
        ]
    )
    assert state["alert_active"] is False


@pytest.mark.asyncio
async def test_log_storage_monitor_disabled_clears_state(monkeypatch):
    StubSettingsRepository.store = {
        "manager_health_monitoring_enabled": "false",
        manager_http_log_storage_monitor.MANAGER_HTTP_LOG_STORAGE_STATE_KEY: json.dumps(
            {"alert_active": True}
        )
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    class UnexpectedDockerClient:
        async def get_manager_http_log_storage(self):
            raise AssertionError("비활성 상태에서는 로그 보관 상태를 조회하면 안 됩니다")

    result = await manager_http_log_storage_monitor.check_manager_http_log_storage_once(
        session_factory=make_session,
        client_factory=UnexpectedDockerClient,
        now=datetime(2026, 7, 14, 18, 0, tzinfo=timezone.utc),
    )

    assert result["enabled"] is False
    assert manager_http_log_storage_monitor.MANAGER_HTTP_LOG_STORAGE_STATE_KEY not in (
        StubSettingsRepository.store
    )
    assert recorded == []

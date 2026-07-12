import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.docker import manager_health_monitor


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
    def __init__(self):
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


@asynccontextmanager
async def make_session():
    yield StubSession()


class StubDockerClient:
    components: list[dict] = []

    async def inspect_manager_components(self) -> list[dict]:
        return self.components


def _component(status: str, *, failing_streak: int = 0, exit_code: int = 0) -> dict:
    return {
        "name": "frontend",
        "health_status": status,
        "health_failing_streak": failing_streak,
        "health_last_exit_code": exit_code,
        "health_last_checked_at": "2026-07-12T18:00:00Z",
    }


def _patch_dependencies(monkeypatch, recorded: list[dict]) -> None:
    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(manager_health_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(manager_health_monitor.audit_service, "record", fake_record, raising=False)


@pytest.mark.asyncio
async def test_manager_health_baseline_healthy_does_not_alert(monkeypatch):
    StubSettingsRepository.store = {}
    StubDockerClient.components = [_component("healthy")]
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    result = await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 18, 0, tzinfo=timezone.utc),
    )

    assert result["unhealthy_count"] == 0
    assert result["recorded_event_count"] == 0
    assert recorded == []
    state = json.loads(StubSettingsRepository.store[manager_health_monitor.MANAGER_HEALTH_STATE_KEY])
    assert state["frontend"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_manager_health_alerts_on_unhealthy_and_recovery(monkeypatch):
    StubSettingsRepository.store = {}
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)
    StubDockerClient.components = [_component("healthy")]
    await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 18, 0, tzinfo=timezone.utc),
    )

    StubDockerClient.components = [_component("unhealthy", failing_streak=3, exit_code=1)]
    failure = await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 18, 1, tzinfo=timezone.utc),
    )
    StubDockerClient.components = [_component("healthy")]
    recovery = await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 18, 2, tzinfo=timezone.utc),
    )

    assert failure["recorded_event_count"] == 1
    assert recovery["recorded_event_count"] == 1
    assert [item["detail"]["event"] for item in recorded] == [
        "manager_docker_unhealthy",
        "manager_docker_recovered",
    ]
    assert recorded[0]["detail"]["failing_streak"] == 3
    assert recorded[0]["detail"]["last_exit_code"] == 1


@pytest.mark.asyncio
async def test_manager_health_cooldown_delays_flapping_alert(monkeypatch):
    StubSettingsRepository.store = {
        manager_health_monitor.MANAGER_HEALTH_STATE_KEY: json.dumps(
            {
                "frontend": {
                    "status": "healthy",
                    "alert_active": False,
                    "last_unhealthy_alert_at": "2026-07-12T18:00:00+00:00",
                    "status_changed_at": "2026-07-12T18:10:00+00:00",
                }
            }
        )
    }
    StubDockerClient.components = [_component("unhealthy", failing_streak=2, exit_code=1)]
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    suppressed = await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 18, 30, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    delayed = await manager_health_monitor.check_manager_health_once(
        session_factory=make_session,
        client_factory=StubDockerClient,
        now=datetime(2026, 7, 12, 19, 1, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )

    assert suppressed["suppressed_count"] == 1
    assert suppressed["recorded_event_count"] == 0
    assert delayed["recorded_event_count"] == 1
    assert recorded[0]["detail"]["event"] == "manager_docker_unhealthy"

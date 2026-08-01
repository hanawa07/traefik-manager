import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.application.encoded_path_block_monitoring import (
    ENCODED_PATH_BLOCK_STATE_KEY,
)
from app.infrastructure.traefik import encoded_path_block_monitor


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


class StubHistory:
    count = 0
    collection_available = True
    collect_calls = 0
    count_calls = 0

    @classmethod
    async def collect(cls, **_kwargs):
        cls.collect_calls += 1
        return {
            "available": True,
            "collection_available": cls.collection_available,
        }

    @classmethod
    def read_count(cls, **_kwargs):
        cls.count_calls += 1
        return cls.count


def _patch_dependencies(monkeypatch, recorded: list[dict]) -> None:
    async def fake_record(**kwargs):
        recorded.append(kwargs)

    StubHistory.collect_calls = 0
    StubHistory.count_calls = 0
    StubHistory.collection_available = True
    monkeypatch.setattr(
        encoded_path_block_monitor,
        "SQLiteSystemSettingsRepository",
        StubSettingsRepository,
    )
    monkeypatch.setattr(
        encoded_path_block_monitor,
        "collect_encoded_path_block_history",
        StubHistory.collect,
    )
    monkeypatch.setattr(
        encoded_path_block_monitor,
        "read_recent_encoded_path_block_count",
        StubHistory.read_count,
    )
    monkeypatch.setattr(
        encoded_path_block_monitor.audit_service,
        "record",
        fake_record,
        raising=False,
    )


@pytest.mark.asyncio
async def test_encoded_path_block_monitor_alerts_cools_down_and_recovers(monkeypatch):
    StubSettingsRepository.store = {
        "traefik_encoded_path_block_monitoring_enabled": "true",
        "traefik_encoded_path_block_window_minutes": "15",
        "traefik_encoded_path_block_threshold": "2",
    }
    StubHistory.count = 2
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    first = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 0, 0, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    suppressed = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 0, 10, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    repeated = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 1, 1, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )
    StubHistory.count = 0
    recovered = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 1, 2, tzinfo=timezone.utc),
        cooldown_seconds=3600,
    )

    assert first["recorded_event_count"] == 1
    assert suppressed["suppressed_count"] == 1
    assert repeated["recorded_event_count"] == 1
    assert recovered["recorded_event_count"] == 1
    assert [item["detail"]["event"] for item in recorded] == [
        "traefik_encoded_path_blocks_high",
        "traefik_encoded_path_blocks_high",
        "traefik_encoded_path_blocks_recovered",
    ]
    assert all("client_ip" not in item["detail"] for item in recorded)
    assert all("path" not in item["detail"] for item in recorded)
    state = json.loads(StubSettingsRepository.store[ENCODED_PATH_BLOCK_STATE_KEY])
    assert state["alert_active"] is False


@pytest.mark.asyncio
async def test_encoded_path_block_monitor_disabled_keeps_history_collection(monkeypatch):
    StubSettingsRepository.store = {
        "traefik_encoded_path_block_monitoring_enabled": "false",
        ENCODED_PATH_BLOCK_STATE_KEY: json.dumps({"alert_active": True}),
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)

    result = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 0, 0, tzinfo=timezone.utc),
    )

    assert result["enabled"] is False
    assert StubHistory.collect_calls == 1
    assert StubHistory.count_calls == 0
    assert ENCODED_PATH_BLOCK_STATE_KEY not in StubSettingsRepository.store
    assert recorded == []


@pytest.mark.asyncio
async def test_encoded_path_block_monitor_preserves_active_state_when_logs_disconnect(
    monkeypatch,
):
    StubSettingsRepository.store = {
        ENCODED_PATH_BLOCK_STATE_KEY: json.dumps(
            {"alert_active": True, "blocked_request_count": 22}
        )
    }
    recorded: list[dict] = []
    _patch_dependencies(monkeypatch, recorded)
    StubHistory.collection_available = False

    result = await encoded_path_block_monitor.check_encoded_path_blocks_once(
        session_factory=make_session,
        now=datetime(2026, 8, 2, 0, 0, tzinfo=timezone.utc),
    )

    state = json.loads(StubSettingsRepository.store[ENCODED_PATH_BLOCK_STATE_KEY])
    assert result["available"] is False
    assert state["alert_active"] is True
    assert StubHistory.count_calls == 0
    assert recorded == []

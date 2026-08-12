from datetime import datetime, timedelta, timezone

import pytest

from app.infrastructure.docker import manager_http_log_reader
from app.infrastructure.docker.manager_http_log_reader import (
    ManagerTraefikAccessLogReader,
)


@pytest.mark.asyncio
async def test_manager_traefik_access_log_reader_caches_recent_sample(monkeypatch):
    calls = []

    async def fake_read_logs(**kwargs):
        calls.append(kwargs)
        return f"sample-{len(calls)}"

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        fake_read_logs,
    )
    reader = ManagerTraefikAccessLogReader(cache_seconds=300)
    checked_at = datetime(2026, 8, 13, 3, 0, tzinfo=timezone.utc)

    assert await reader.read(docker_enabled=True, now=checked_at) == "sample-1"
    assert await reader.read(
        docker_enabled=True,
        now=checked_at + timedelta(seconds=299),
    ) == "sample-1"
    assert await reader.read(
        docker_enabled=True,
        now=checked_at + timedelta(seconds=300),
    ) == "sample-2"

    assert len(calls) == 2
    assert all(call["container_name"] == "traefik" for call in calls)
    assert all(call["tail_lines"] == 2000 for call in calls)
    assert calls[0]["since"] == int((checked_at - timedelta(hours=24)).timestamp())
    assert calls[1]["since"] == int(
        (checked_at - timedelta(hours=24) + timedelta(seconds=300)).timestamp()
    )


@pytest.mark.asyncio
async def test_manager_traefik_access_log_reader_skips_cache_on_failure(monkeypatch):
    responses = [None, "recovered"]

    async def fake_read_logs(**_kwargs):
        return responses.pop(0)

    monkeypatch.setattr(
        manager_http_log_reader,
        "read_docker_container_logs_text",
        fake_read_logs,
    )
    reader = ManagerTraefikAccessLogReader(cache_seconds=300)
    checked_at = datetime(2026, 8, 13, 3, 0, tzinfo=timezone.utc)

    assert await reader.read(docker_enabled=True, now=checked_at) is None
    assert await reader.read(docker_enabled=True, now=checked_at) == "recovered"
    assert responses == []

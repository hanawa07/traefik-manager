from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik.traefik_api_client import TraefikApiClient


@pytest.mark.asyncio
async def test_get_health_includes_latest_version_update_status(monkeypatch):
    client = TraefikApiClient()
    checked_at = datetime(2026, 6, 28, 1, 20, 0, tzinfo=timezone.utc)

    async def fake_get(path: str):
        if path == "/api/overview":
            return {"version": "3.5.3"}
        if path == "/api/version":
            return {}
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(
        client,
        "_get_latest_version_info",
        AsyncMock(
            return_value={
                "latest_version": "v3.5.4",
                "update_available": None,
                "latest_version_checked_at": checked_at,
                "latest_version_error": None,
            }
        ),
    )

    result = await client.get_health()

    assert result["connected"] is True
    assert result["version"] == "3.5.3"
    assert result["latest_version"] == "v3.5.4"
    assert result["latest_version_checked_at"] == checked_at
    assert result["update_available"] is True


@pytest.mark.asyncio
async def test_get_health_uses_version_endpoint_when_overview_has_no_version(monkeypatch):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/overview":
            return {"http": {"routers": {"total": 1}}}
        if path == "/api/version":
            return {"Version": "3.3.7", "Codename": "saintnectaire"}
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(
        client,
        "_get_latest_version_info",
        AsyncMock(
            return_value={
                "latest_version": "v3.7.5",
                "update_available": None,
                "latest_version_checked_at": datetime(2026, 6, 28, 1, 20, 0, tzinfo=timezone.utc),
                "latest_version_error": None,
            }
        ),
    )

    result = await client.get_health()

    assert result["connected"] is True
    assert result["version"] == "3.3.7"
    assert result["latest_version"] == "v3.7.5"
    assert result["update_available"] is True

import pytest

from app.interfaces.api.v1.routers import traefik as traefik_router


class StubTraefikClient:
    async def get_encoded_path_blocks(self):
        return {
            "available": True,
            "blocked_request_count": 12,
        }


@pytest.mark.asyncio
async def test_encoded_path_block_route_merges_alert_monitor_status(monkeypatch):
    async def fake_read_status(repo):
        assert repo is not None
        return {
            "alert_monitoring_enabled": True,
            "alert_active": True,
            "alert_window_minutes": 15,
            "alert_threshold": 20,
            "recent_blocked_request_count": 25,
        }

    monkeypatch.setattr(
        traefik_router,
        "read_encoded_path_block_monitor_status",
        fake_read_status,
    )

    result = await traefik_router.get_traefik_encoded_path_blocks(
        traefik_client=StubTraefikClient(),
        db=object(),
        _={"username": "admin"},
    )

    assert result["blocked_request_count"] == 12
    assert result["alert_active"] is True
    assert result["recent_blocked_request_count"] == 25

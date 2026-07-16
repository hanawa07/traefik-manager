import pytest

from app.infrastructure.traefik.traefik_api_client import (
    TraefikApiClient,
    TraefikApiClientError,
)


@pytest.mark.asyncio
async def test_manager_route_status_reads_file_provider_upstream(monkeypatch):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/http/routers":
            return [
                {
                    "name": "traefik-manager-frontend-file@file",
                    "provider": "file",
                    "status": "enabled",
                },
                {
                    "name": "traefik-manager-frontend-http-file@file",
                    "provider": "file",
                    "status": "enabled",
                },
            ]
        return [
            {
                "name": "traefik-manager-frontend-file@file",
                "provider": "file",
                "status": "enabled",
                "loadBalancer": {
                    "servers": [{"url": "http://traefik-manager-frontend-blue:3000"}],
                },
                "serverStatus": {"http://traefik-manager-frontend-blue:3000": "UP"},
            }
        ]

    monkeypatch.setattr(client, "_get", fake_get)

    result = await client.get_manager_route_status()

    assert result == {
        "available": True,
        "healthy": True,
        "message": "Manager file-provider 라우터가 정상입니다",
        "active_slot": "blue",
        "provider": "file",
        "https_router_status": "enabled",
        "http_router_status": "enabled",
        "service_status": "enabled",
        "upstream_url": "http://traefik-manager-frontend-blue:3000",
        "upstream_status": "UP",
    }


@pytest.mark.asyncio
async def test_manager_route_status_handles_traefik_api_failure(monkeypatch):
    client = TraefikApiClient()

    async def fail_get(_path: str):
        raise TraefikApiClientError("연결 실패")

    monkeypatch.setattr(client, "_get", fail_get)

    result = await client.get_manager_route_status()

    assert result["available"] is False
    assert result["healthy"] is False
    assert result["provider"] is None

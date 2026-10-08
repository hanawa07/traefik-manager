import pytest

from app.infrastructure.traefik import traefik_api_client as client_module
from app.infrastructure.traefik.traefik_api_client import (
    TraefikApiClient,
    TraefikApiClientError,
)


@pytest.mark.asyncio
async def test_get_rejects_non_collection_json(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return "not-a-traefik-payload"

    class FakeAsyncClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        async def get(self, _path, params=None):
            assert params is None
            return FakeResponse()

    monkeypatch.setattr(client_module.httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(TraefikApiClientError, match="/api/overview"):
        await TraefikApiClient()._get("/api/overview")


@pytest.mark.asyncio
async def test_get_requests_full_traefik_collection(monkeypatch):
    requests = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return []

    class FakeAsyncClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        async def get(self, path, params=None):
            requests.append((path, params))
            return FakeResponse()

    monkeypatch.setattr(client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = TraefikApiClient()
    await client._get("/api/http/routers")
    await client._get("/api/http/services")
    await client._get("/api/http/middlewares")

    assert requests == [
        ("/api/http/routers", {"per_page": 1000}),
        ("/api/http/services", {"per_page": 1000}),
        ("/api/http/middlewares", {"per_page": 1000}),
    ]

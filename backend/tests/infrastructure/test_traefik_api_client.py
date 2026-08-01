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

        async def get(self, _path):
            return FakeResponse()

    monkeypatch.setattr(client_module.httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(TraefikApiClientError, match="/api/overview"):
        await TraefikApiClient()._get("/api/overview")

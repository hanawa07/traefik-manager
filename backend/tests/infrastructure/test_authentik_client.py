from unittest.mock import ANY, AsyncMock

import pytest

from app.infrastructure.authentik.client import AuthentikClient


class FakeResponse:
    def __init__(self, payload=None):
        self.payload = payload or {}
        self.raise_called = False

    def json(self):
        return self.payload

    def raise_for_status(self):
        self.raise_called = True


class FakeRequestClient:
    def __init__(self, response):
        self.response = response
        self.calls = []

    async def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.response


@pytest.mark.asyncio
async def test_request_builds_shared_options_and_honors_raise_flag():
    client = AuthentikClient()
    response = FakeResponse({"ok": True})
    request_client = FakeRequestClient(response)

    result = await client._request(
        "POST",
        "/example/",
        client=request_client,
        json={"name": "Example"},
    )

    assert result is response
    assert response.raise_called is True
    assert request_client.calls == [
        (
            "POST",
            f"{client.base_url}/example/",
            {
                "headers": client.headers,
                "timeout": client.timeout,
                "json": {"name": "Example"},
            },
        )
    ]

    quiet_response = FakeResponse()
    await client._request(
        "DELETE",
        "/example/",
        client=FakeRequestClient(quiet_response),
        raise_for_status=False,
    )

    assert quiet_response.raise_called is False


@pytest.mark.asyncio
async def test_create_proxy_provider_uses_shared_request_helper(monkeypatch):
    client = AuthentikClient()
    request = AsyncMock(return_value=FakeResponse({"pk": 123}))
    monkeypatch.setattr(client, "_request", request)
    monkeypatch.setattr(client, "_get_default_auth_flow", AsyncMock(return_value="auth-flow"))
    monkeypatch.setattr(client, "_get_default_invalidation_flow", AsyncMock(return_value="invalidation-flow"))

    result = await client.create_proxy_provider("Example", "example.com")

    assert result == {"pk": 123}
    request.assert_awaited_once_with(
        "POST",
        "/providers/proxy/",
        client=ANY,
        json={
            "name": "Example",
            "external_host": "https://example.com",
            "mode": "forward_single",
            "authorization_flow": "auth-flow",
            "invalidation_flow": "invalidation-flow",
        },
    )


@pytest.mark.asyncio
async def test_list_groups_filters_incomplete_items(monkeypatch):
    client = AuthentikClient()
    monkeypatch.setattr(
        client,
        "_request",
        AsyncMock(
            return_value=FakeResponse(
                {
                    "results": [
                        {"pk": 1, "name": "admins"},
                        {"pk": None, "name": "missing-id"},
                        {"pk": 2, "name": ""},
                    ]
                }
            )
        ),
    )

    result = await client.list_groups()

    assert result == [{"id": "1", "name": "admins"}]


@pytest.mark.asyncio
async def test_delete_provider_keeps_non_raising_delete_behavior(monkeypatch):
    client = AuthentikClient()
    request = AsyncMock(return_value=FakeResponse())
    monkeypatch.setattr(client, "_request", request)

    await client.delete_provider("provider-id")

    request.assert_awaited_once_with(
        "DELETE",
        "/providers/proxy/provider-id/",
        raise_for_status=False,
    )

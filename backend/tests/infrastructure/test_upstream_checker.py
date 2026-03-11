from types import SimpleNamespace

import httpx
import pytest

from app.infrastructure.health import upstream_checker


@pytest.mark.asyncio
async def test_check_upstream_uses_https_scheme_and_skip_tls_verify(monkeypatch):
    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, *, timeout, follow_redirects, verify):
            captured["timeout"] = timeout
            captured["follow_redirects"] = follow_redirects
            captured["verify"] = verify

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            captured["url"] = url
            return SimpleNamespace(status_code=200)

    monkeypatch.setattr(upstream_checker.httpx, "AsyncClient", FakeAsyncClient)

    result = await upstream_checker.check_upstream(
        host="example.com",
        port=443,
        scheme="https",
        skip_tls_verify=True,
    )

    assert captured == {
        "timeout": 3.0,
        "follow_redirects": False,
        "verify": False,
        "url": "https://example.com:443/",
    }
    assert result["status"] == "up"
    assert result["status_code"] == 200


@pytest.mark.asyncio
async def test_check_upstream_maps_dns_resolution_failures(monkeypatch):
    request = httpx.Request("GET", "http://example.com:80/")

    class FakeAsyncClient:
        def __init__(self, *, timeout, follow_redirects, verify):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            raise httpx.ConnectError("[Errno -3] Temporary failure in name resolution", request=request)

    monkeypatch.setattr(upstream_checker.httpx, "AsyncClient", FakeAsyncClient)

    result = await upstream_checker.check_upstream("example.com", 80)

    assert result["status"] == "down"
    assert result["error"] == "DNS resolution failed"

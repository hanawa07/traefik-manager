from types import SimpleNamespace

import httpx
import pytest
from datetime import datetime, timezone

from app.infrastructure.health import upstream_checker


@pytest.mark.asyncio
async def test_check_upstream_uses_https_scheme_and_skip_tls_verify(monkeypatch):
    captured: dict[str, object] = {}
    checked_at = datetime(2026, 3, 11, 14, 30, 0, tzinfo=timezone.utc)

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
    monkeypatch.setattr(upstream_checker, "_checked_at_now", lambda: checked_at)

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
    assert result["checked_url"] == "https://example.com:443/"
    assert result["checked_at"] == checked_at.isoformat()
    assert result["error_kind"] is None


@pytest.mark.asyncio
async def test_check_upstream_maps_dns_resolution_failures(monkeypatch):
    request = httpx.Request("GET", "http://example.com:80/")
    checked_at = datetime(2026, 3, 11, 14, 31, 0, tzinfo=timezone.utc)

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
    monkeypatch.setattr(upstream_checker, "_checked_at_now", lambda: checked_at)

    result = await upstream_checker.check_upstream("example.com", 80)

    assert result["status"] == "down"
    assert result["error"] == "DNS resolution failed"
    assert result["error_kind"] == "dns"
    assert result["checked_url"] == "http://example.com:80/"
    assert result["checked_at"] == checked_at.isoformat()


@pytest.mark.asyncio
async def test_check_upstream_returns_unknown_when_healthcheck_disabled(monkeypatch):
    checked_at = datetime(2026, 3, 11, 14, 32, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(upstream_checker, "_checked_at_now", lambda: checked_at)
    result = await upstream_checker.check_upstream(
        host="example.com",
        port=443,
        healthcheck_enabled=False,
    )

    assert result == {
        "status": "unknown",
        "status_code": None,
        "latency_ms": None,
        "error": "Health check disabled",
        "error_kind": "disabled",
        "checked_url": "http://example.com:443/",
        "checked_at": checked_at.isoformat(),
    }


@pytest.mark.asyncio
async def test_check_upstream_uses_custom_path_timeout_and_expected_statuses(monkeypatch):
    captured: dict[str, object] = {}
    checked_at = datetime(2026, 3, 11, 14, 33, 0, tzinfo=timezone.utc)

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
            return SimpleNamespace(status_code=503)

    monkeypatch.setattr(upstream_checker.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(upstream_checker, "_checked_at_now", lambda: checked_at)

    result = await upstream_checker.check_upstream(
        host="example.com",
        port=8443,
        scheme="https",
        skip_tls_verify=True,
        healthcheck_path="/readyz",
        healthcheck_timeout_ms=1250,
        healthcheck_expected_statuses=[200, 204],
    )

    assert captured == {
        "timeout": 1.25,
        "follow_redirects": False,
        "verify": False,
        "url": "https://example.com:8443/readyz",
    }
    assert result["status"] == "down"
    assert result["status_code"] == 503
    assert result["error"] == "Unexpected status: 503"
    assert result["error_kind"] == "unexpected_status"
    assert result["checked_url"] == "https://example.com:8443/readyz"
    assert result["checked_at"] == checked_at.isoformat()

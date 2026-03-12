from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik.traefik_api_client import TraefikApiClient


@pytest.mark.asyncio
async def test_list_certificates_uses_docker_acme_fallback_when_local_mount_is_unreadable(
    monkeypatch,
):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/overview":
            return {}
        if path == "/api/http/routers":
            return {
                "example-com@file": {
                    "name": "example-com@file",
                    "rule": "Host(`example.com`)",
                    "tls": {"options": "default"},
                }
            }
        raise AssertionError(f"unexpected path: {path}")

    docker_read = AsyncMock(
        return_value='{"letsencrypt":{"Certificates":[{"certificate":"dummy","domain":{"main":"example.com"}}]}}'
    )

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(client, "_read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(client, "_read_docker_acme_json_text", docker_read)
    monkeypatch.setattr(
        client,
        "_extract_acme_certificate_expiry",
        lambda _cert_b64: datetime(2026, 6, 5, 6, 15, 36, tzinfo=timezone.utc),
    )

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "active"
    assert result[0]["expires_at"] == datetime(2026, 6, 5, 6, 15, 36, tzinfo=timezone.utc)
    docker_read.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_certificates_marks_pending_when_cert_resolver_exists_without_expiry(
    monkeypatch,
):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/overview":
            return {}
        if path == "/api/http/routers":
            return {
                "example-com@file": {
                    "name": "example-com@file",
                    "rule": "Host(`example.com`)",
                    "tls": {"certResolver": "letsencrypt"},
                }
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(client, "_read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(client, "_read_docker_acme_json_text", AsyncMock(return_value=None))

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "pending"
    assert result[0]["status_message"] == "정식 인증서 발급 대기 또는 검증 실패"
    assert result[0]["expires_at"] is None


@pytest.mark.asyncio
async def test_list_certificates_marks_inactive_without_cert_resolver_and_expiry(
    monkeypatch,
):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/overview":
            return {}
        if path == "/api/http/routers":
            return {
                "example-com@file": {
                    "name": "example-com@file",
                    "rule": "Host(`example.com`)",
                    "tls": {"options": "default"},
                }
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(client, "_read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(client, "_read_docker_acme_json_text", AsyncMock(return_value=None))

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "inactive"
    assert result[0]["status_message"] == "자동 인증서 발급 미설정"
    assert result[0]["expires_at"] is None

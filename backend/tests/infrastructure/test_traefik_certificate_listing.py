from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik import traefik_api_client as traefik_client_module
from app.infrastructure.traefik.certificate_response_builder import to_certificate_response
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
    monkeypatch.setattr(traefik_client_module, "read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(traefik_client_module, "read_docker_acme_json_text", docker_read)
    monkeypatch.setattr(
        traefik_client_module,
        "extract_acme_certificate_expiry",
        lambda _cert_b64: datetime(2099, 6, 5, 6, 15, 36, tzinfo=timezone.utc),
    )

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "active"
    assert result[0]["expires_at"] == datetime(2099, 6, 5, 6, 15, 36, tzinfo=timezone.utc)
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
    monkeypatch.setattr(traefik_client_module, "read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(traefik_client_module, "read_docker_acme_json_text", AsyncMock(return_value=None))

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "pending"
    assert result[0]["status_message"] == "정식 인증서 발급 대기 또는 검증 실패"
    assert result[0]["expires_at"] is None


@pytest.mark.asyncio
async def test_list_certificates_includes_recent_acme_failure(monkeypatch):
    client = TraefikApiClient()

    async def fake_get(path: str):
        if path == "/api/overview":
            return {}
        if path == "/api/http/routers":
            return {
                "traefik-dashboard-public@file": {
                    "name": "traefik-dashboard-public@file",
                    "rule": "Host(`traefik.lizstudio.co.kr`)",
                    "tls": {"certResolver": "letsencrypt"},
                }
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(client, "_get", fake_get)
    monkeypatch.setattr(traefik_client_module, "read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(traefik_client_module, "read_docker_acme_json_text", AsyncMock(return_value=None))
    monkeypatch.setattr(
        traefik_client_module,
        "read_docker_container_logs_text",
        AsyncMock(
            return_value=(
                '2026-03-12T11:09:13Z ERR Unable to obtain ACME certificate for domains '
                'error="unable to generate a certificate for the domains [traefik.lizstudio.co.kr]: '
                'error: one or more domains had a problem:\\n'
                '[traefik.lizstudio.co.kr] invalid authorization: acme: error: 400 :: '
                'urn:ietf:params:acme:error:dns :: While processing CAA for traefik.lizstudio.co.kr: '
                'DNS problem: query timed out looking up CAA for traefik.lizstudio.co.kr\\n" '
                'ACME CA=https://acme-v02.api.letsencrypt.org/directory '
                'domains=["traefik.lizstudio.co.kr"] providerName=letsencrypt.acme '
                'routerName=traefik-dashboard-public@file'
            )
        ),
    )

    result = await client.list_certificates()

    assert result[0]["status"] == "pending"
    assert result[0]["last_acme_error_kind"] == "dns"
    assert result[0]["last_acme_error_message"] == (
        "DNS problem: query timed out looking up CAA for traefik.lizstudio.co.kr"
    )
    assert result[0]["last_acme_error_at"] == datetime(2026, 3, 12, 11, 9, 13, tzinfo=timezone.utc)


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
    monkeypatch.setattr(traefik_client_module, "read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(traefik_client_module, "read_docker_acme_json_text", AsyncMock(return_value=None))

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "inactive"
    assert result[0]["status_message"] == "자동 인증서 발급 미설정"
    assert result[0]["expires_at"] is None


def test_certificate_response_keeps_more_than_30_days_active():
    result = to_certificate_response(
        {
            "domain": "example.com",
            "router_names": {"example-com"},
            "cert_resolvers": {"letsencrypt"},
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30, hours=12),
        }
    )

    assert result["days_remaining"] == 31
    assert result["status"] == "active"
    assert result["status_message"] == "정상"


def test_certificate_response_warns_at_30_days_or_less():
    result = to_certificate_response(
        {
            "domain": "example.com",
            "router_names": {"example-com"},
            "cert_resolvers": {"letsencrypt"},
            "expires_at": datetime.now(timezone.utc) + timedelta(days=29, hours=12),
        }
    )

    assert result["days_remaining"] == 30
    assert result["status"] == "warning"
    assert result["status_message"] == "30일 이내 만료 예정"

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


def test_decode_docker_log_stream_strips_multiplex_headers():
    client = TraefikApiClient()
    first = b"2026-03-12T11:09:13Z first line\n"
    second = b"2026-03-12T11:10:13Z second line\n"
    payload = (
        b"\x01\x00\x00\x00"
        + len(first).to_bytes(4, byteorder="big")
        + first
        + b"\x01\x00\x00\x00"
        + len(second).to_bytes(4, byteorder="big")
        + second
    )

    decoded = client._decode_docker_log_stream(payload)

    assert "first line" in decoded
    assert "second line" in decoded
    assert "\x00" not in decoded


def test_parse_recent_acme_failures_extracts_domain_kind_and_message():
    client = TraefikApiClient()
    raw_text = (
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

    failures = client._parse_recent_acme_failures(raw_text)

    assert failures["traefik.lizstudio.co.kr"]["kind"] == "dns"
    assert failures["traefik.lizstudio.co.kr"]["message"] == (
        "DNS problem: query timed out looking up CAA for traefik.lizstudio.co.kr"
    )
    assert failures["traefik.lizstudio.co.kr"]["occurred_at"] == datetime(
        2026, 3, 12, 11, 9, 13, tzinfo=timezone.utc
    )


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
    monkeypatch.setattr(client, "_read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(client, "_read_docker_acme_json_text", AsyncMock(return_value=None))
    monkeypatch.setattr(
        client,
        "_read_docker_container_logs_text",
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
    monkeypatch.setattr(client, "_read_local_acme_json_text", lambda: None)
    monkeypatch.setattr(client, "_read_docker_acme_json_text", AsyncMock(return_value=None))

    result = await client.list_certificates()

    assert result[0]["domain"] == "example.com"
    assert result[0]["status"] == "inactive"
    assert result[0]["status_message"] == "자동 인증서 발급 미설정"
    assert result[0]["expires_at"] is None

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.traefik import traefik_api_client as traefik_client_module
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient


@pytest.mark.asyncio
async def test_get_certificate_preflight_reports_dns_http_and_default_cert(monkeypatch):
    client = TraefikApiClient()

    monkeypatch.setattr(
        client,
        "list_certificates",
        AsyncMock(
            return_value=[
                {
                    "domain": "example.com",
                    "router_names": ["example@file"],
                    "cert_resolvers": ["letsencrypt"],
                    "expires_at": None,
                    "days_remaining": None,
                    "status": "pending",
                    "status_message": "정식 인증서 발급 대기 또는 검증 실패",
                    "last_acme_error_at": datetime(2026, 3, 12, 11, 9, 13, tzinfo=timezone.utc),
                    "last_acme_error_message": "DNS problem: query timed out looking up A for example.com",
                    "last_acme_error_kind": "dns",
                }
            ]
        ),
    )
    monkeypatch.setattr(
        traefik_client_module,
        "resolve_public_dns_records",
        AsyncMock(
            return_value={
                "ok": True,
                "a_records": ["220.117.211.140"],
                "aaaa_records": [],
                "error": None,
            }
        ),
    )
    monkeypatch.setattr(
        traefik_client_module,
        "probe_http_challenge_path",
        AsyncMock(
            return_value={
                "ok": True,
                "status_code": 404,
                "location": None,
                "error": None,
            }
        ),
    )
    monkeypatch.setattr(
        traefik_client_module,
        "inspect_presented_certificate",
        AsyncMock(
            return_value={
                "ok": True,
                "default_cert": True,
                "subject_common_name": "TRAEFIK DEFAULT CERT",
                "issuer_common_name": "TRAEFIK DEFAULT CERT",
                "error": None,
            }
        ),
    )

    result = await client.get_certificate_preflight("example.com")

    assert result["domain"] == "example.com"
    assert result["overall_status"] == "warning"
    assert result["recommendation"] == "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요."
    assert {item["key"] for item in result["items"]} == {
        "router_detected",
        "cert_resolver",
        "dns_public",
        "http_challenge",
        "https_certificate",
        "recent_acme_failure",
    }
    assert next(item for item in result["items"] if item["key"] == "https_certificate")["status"] == "warning"
    assert next(item for item in result["items"] if item["key"] == "recent_acme_failure")["status"] == "warning"


@pytest.mark.asyncio
async def test_get_certificate_preflight_reports_missing_router(monkeypatch):
    client = TraefikApiClient()

    monkeypatch.setattr(client, "list_certificates", AsyncMock(return_value=[]))
    monkeypatch.setattr(
        traefik_client_module,
        "resolve_public_dns_records",
        AsyncMock(return_value={"ok": False, "a_records": [], "aaaa_records": [], "error": "lookup failed"}),
    )
    monkeypatch.setattr(
        traefik_client_module,
        "probe_http_challenge_path",
        AsyncMock(return_value={"ok": False, "status_code": None, "location": None, "error": "timeout"}),
    )
    monkeypatch.setattr(
        traefik_client_module,
        "inspect_presented_certificate",
        AsyncMock(
            return_value={
                "ok": False,
                "default_cert": False,
                "subject_common_name": None,
                "issuer_common_name": None,
                "error": "connect failed",
            }
        ),
    )

    result = await client.get_certificate_preflight("missing.example.com")

    assert result["overall_status"] == "error"
    assert result["recommendation"] == "도메인 라우트가 실제로 생성됐는지 먼저 확인하세요."
    assert next(item for item in result["items"] if item["key"] == "router_detected")["status"] == "error"

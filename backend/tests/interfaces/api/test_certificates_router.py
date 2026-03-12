import pytest

from app.interfaces.api.v1.routers import certificates as certificates_router


@pytest.mark.asyncio
async def test_list_certificates_includes_alert_suppression_metadata(monkeypatch):
    class StubTraefikClient:
        async def list_certificates(self):
            return [
                {
                    "domain": "example.com",
                    "router_names": ["example-router"],
                    "cert_resolvers": ["letsencrypt"],
                    "expires_at": "2026-03-20T00:00:00+00:00",
                    "days_remaining": 8,
                    "status": "warning",
                    "status_message": "8일 이내 만료 예정",
                }
            ]

    async def fake_get_alert_state(_db):
        return {
            "example.com": {
                "status": "warning",
                "status_started_at": "2026-03-12T00:00:00+00:00",
            }
        }

    monkeypatch.setattr(certificates_router, "_get_certificate_alert_state", fake_get_alert_state)

    result = await certificates_router.list_certificates(
        traefik_client=StubTraefikClient(),
        db=object(),
        _={"role": "admin"},
    )

    assert result[0].alerts_suppressed is True
    assert result[0].status_started_at.isoformat() == "2026-03-12T00:00:00+00:00"


@pytest.mark.asyncio
async def test_check_certificates_returns_summary(monkeypatch):
    async def fake_check_certificate_alerts_once(**_kwargs):
        return {
            "checked_at": "2026-03-12T04:30:00+00:00",
            "total_count": 3,
            "warning_count": 1,
            "error_count": 1,
            "recorded_event_count": 1,
        }

    monkeypatch.setattr(
        certificates_router,
        "check_certificate_alerts_once",
        fake_check_certificate_alerts_once,
    )

    result = await certificates_router.check_certificates(
        traefik_client=object(),
        _={"role": "admin"},
    )

    assert result["total_count"] == 3
    assert result["warning_count"] == 1
    assert result["error_count"] == 1
    assert result["recorded_event_count"] == 1


@pytest.mark.asyncio
async def test_preflight_certificate_returns_diagnostics(monkeypatch):
    class StubTraefikClient:
        async def get_certificate_preflight(self, domain: str):
            return {
                "domain": domain,
                "checked_at": "2026-03-12T12:00:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "ok",
                        "detail": "A 1개, AAAA 없음",
                    }
                ],
            }

    result = await certificates_router.preflight_certificate(
        domain="example.com",
        traefik_client=StubTraefikClient(),
        _={"role": "admin"},
    )

    assert result["domain"] == "example.com"
    assert result["overall_status"] == "warning"
    assert result["items"][0]["key"] == "dns_public"

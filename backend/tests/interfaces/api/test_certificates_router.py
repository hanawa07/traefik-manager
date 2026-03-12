from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.interfaces.api.v1.routers import certificates as certificates_router


class StubScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class StubExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return StubScalarResult(self._items)


class StubAuditDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


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
    captured_record = {}

    class StubTraefikClient:
        async def get_certificate_preflight(self, domain: str):
            return {
                "domain": domain,
                "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
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

    async def fake_record(**kwargs):
        captured_record.update(kwargs)

    previous_log = SimpleNamespace(
        detail={
            "event": "certificate_preflight",
            "checked_at": "2026-03-12T11:45:00+00:00",
            "overall_status": "error",
            "recommendation": "직전에는 DNS timeout이 있어 권한 DNS를 먼저 확인해야 했습니다.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
        created_at=datetime(2026, 3, 12, 11, 45, tzinfo=timezone.utc),
    )

    monkeypatch.setattr(certificates_router.audit_service, "record", fake_record)

    result = await certificates_router.preflight_certificate(
        domain="example.com",
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        traefik_client=StubTraefikClient(),
        db=StubAuditDb([previous_log]),
        current_user={"role": "admin", "username": "admin"},
    )

    assert result["domain"] == "example.com"
    assert result["overall_status"] == "warning"
    assert result["items"][0]["key"] == "dns_public"
    assert result["previous_result"]["overall_status"] == "error"
    assert captured_record["resource_type"] == "certificate"
    assert captured_record["resource_name"] == "example.com"
    assert captured_record["detail"]["event"] == "certificate_preflight"
    assert captured_record["detail"]["client_ip"] == "127.0.0.1"
    assert captured_record["detail"]["checked_at"] == "2026-03-12T12:00:00+00:00"

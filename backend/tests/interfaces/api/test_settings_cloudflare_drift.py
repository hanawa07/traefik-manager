import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_cloudflare_router_fakes import (
    DriftCloudflareClient,
    DriftServiceRepository,
    FailingDriftCloudflareClient,
    FailingDriftServiceRepository,
    make_http_request,
    patch_audit_recording,
)


@pytest.mark.asyncio
async def test_diagnose_cloudflare_dns_drift_returns_missing_mismatch_and_orphan(monkeypatch):
    recorded = patch_audit_recording(monkeypatch, "203.0.113.21")
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", DriftServiceRepository)

    response = await settings_router.diagnose_cloudflare_dns_drift(
        request=make_http_request(),
        db=object(),
        cloudflare_client=DriftCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is False
    assert response.zone_count == 1
    assert response.eligible_services == 3
    assert response.skipped_services == 1
    assert response.healthy_services == 1
    assert response.detail == "정상 1개, 비Cloudflare 도메인 1개 제외"
    assert response.zones[0].zone_name == "example.com"
    assert [item.domain for item in response.missing_records] == ["missing.example.com"]
    assert [item.domain for item in response.mismatched_records] == ["api.example.com"]
    assert [item.domain for item in response.orphan_records] == ["old.example.com"]
    assert [item.domain for item in response.excluded_services] == ["outside.other.kr"]
    assert recorded[0]["resource_name"] == "Cloudflare DNS 드리프트 진단"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_drift"
    assert recorded[0]["detail"]["missing_records"] == 1
    assert recorded[0]["detail"]["mismatched_records"] == 1
    assert recorded[0]["detail"]["orphan_records"] == 1
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.21"


@pytest.mark.asyncio
async def test_diagnose_cloudflare_dns_drift_returns_failure_response_when_cloudflare_errors(monkeypatch):
    recorded = patch_audit_recording(monkeypatch, "203.0.113.22")
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", FailingDriftServiceRepository)

    response = await settings_router.diagnose_cloudflare_dns_drift(
        request=make_http_request(),
        db=object(),
        cloudflare_client=FailingDriftCloudflareClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is False
    assert response.message == "Cloudflare DNS 드리프트 진단에 실패했습니다"
    assert "403" in (response.detail or "")
    assert response.zone_count == 1
    assert response.total_services == 1
    assert response.eligible_services == 1
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_drift"
    assert recorded[0]["detail"]["success"] is False
    assert "403" in recorded[0]["detail"]["detail"]
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.22"

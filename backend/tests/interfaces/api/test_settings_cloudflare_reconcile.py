import pytest

from app.interfaces.api.v1.routers import settings_cloudflare_router as settings_router
from tests.interfaces.api.settings_cloudflare_router_fakes import (
    ReconcileCloudflareClient,
    ReconcileServiceRepository,
    make_http_request,
    patch_audit_recording,
)


@pytest.mark.asyncio
async def test_reconcile_cloudflare_dns_syncs_zone_services_and_records_audit(monkeypatch):
    recorded = patch_audit_recording(monkeypatch, "203.0.113.20")
    client = ReconcileCloudflareClient()
    ReconcileServiceRepository.saved_services = []
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", ReconcileServiceRepository)

    response = await settings_router.reconcile_cloudflare_dns(
        request=make_http_request(),
        db=object(),
        cloudflare_client=client,
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert response.message == "Cloudflare DNS 재동기화가 완료되었습니다"
    assert response.detail == "Cloudflare 관리 대상 서비스 2개를 동기화했습니다, 고아 레코드 1개를 정리했습니다, 비Cloudflare 도메인 1개는 제외했습니다"
    assert ReconcileServiceRepository.saved_services == [
        ("app.example.com", "cf-app.example.com"),
        ("api.example.com", "cf-api.example.com"),
    ]
    assert client.deleted_records == [("old.example.com", "record-2")]
    assert recorded[0]["resource_name"] == "Cloudflare DNS 재동기화"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare_reconcile"
    assert recorded[0]["detail"]["success"] is True
    assert recorded[0]["detail"]["synced_services"] == 2
    assert recorded[0]["detail"]["cleaned_records"] == 1
    assert recorded[0]["detail"]["skipped_services"] == 1
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.20"

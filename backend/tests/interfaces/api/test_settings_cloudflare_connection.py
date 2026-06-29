import pytest

from app.interfaces.api.v1.routers import settings_cloudflare_router as settings_router
from tests.interfaces.api.settings_cloudflare_router_fakes import (
    SuccessfulCloudflareConnectionClient,
    make_http_request,
    patch_audit_recording,
)


@pytest.mark.asyncio
async def test_test_cloudflare_connection_returns_success(monkeypatch):
    recorded = patch_audit_recording(monkeypatch, "203.0.113.10")

    response = await settings_router.test_cloudflare_connection(
        request=make_http_request(),
        db=object(),
        cloudflare_client=SuccessfulCloudflareConnectionClient(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert response.message == "Cloudflare 연결에 성공했습니다"
    assert response.detail == "example.com 영역에 접근할 수 있습니다"
    assert recorded[0]["resource_type"] == "settings"
    assert recorded[0]["resource_name"] == "Cloudflare 연결 테스트"
    assert recorded[0]["detail"]["event"] == "settings_test_cloudflare"
    assert recorded[0]["detail"]["success"] is True
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.10"

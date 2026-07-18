import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_security_alert_router_fakes import (
    ADMIN_USER,
    capture_audit_records,
    make_http_request,
    patch_settings_repository,
    patch_smoke_admin_stale_test_alert_sender,
    patch_test_alert_sender,
)


@pytest.mark.asyncio
async def test_test_security_alert_settings_returns_success(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
        },
    )
    called = patch_test_alert_sender(
        monkeypatch,
        {
            "success": True,
            "provider": "slack",
            "message": "테스트 보안 알림을 전송했습니다",
            "detail": "Slack webhook으로 테스트 payload를 전송했습니다",
        },
    )
    recorded = capture_audit_records(monkeypatch)
    db = object()

    response = await settings_router.test_security_alert_settings(
        request=make_http_request(),
        db=db,
        _=ADMIN_USER,
    )

    assert called["db"] is db
    assert response.success is True
    assert response.provider == "slack"
    assert response.message == "테스트 보안 알림을 전송했습니다"
    assert recorded[0]["resource_type"] == "settings"
    assert recorded[0]["resource_name"] == "보안 알림 테스트"
    assert recorded[0]["detail"]["event"] == "settings_test_security_alert"
    assert recorded[0]["detail"]["provider"] == "slack"
    assert recorded[0]["detail"]["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_smoke_admin_stale_dry_run_returns_telegram_result(monkeypatch):
    called = patch_smoke_admin_stale_test_alert_sender(
        monkeypatch,
        {
            "success": True,
            "provider": "telegram",
            "message": "관리자 지연 알림 dry-run을 전송했습니다",
            "detail": "telegram 채널로 전송했습니다",
        },
    )
    recorded = capture_audit_records(monkeypatch)
    db = object()

    response = await settings_router.test_smoke_admin_stale_alert(
        request=make_http_request(),
        db=db,
        actor=ADMIN_USER,
    )

    assert called["db"] is db
    assert response.success is True
    assert response.provider == "telegram"
    assert recorded[0]["detail"]["provider"] == "telegram"

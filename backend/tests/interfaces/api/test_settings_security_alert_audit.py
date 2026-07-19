import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsUpdateRequest
from tests.interfaces.api.settings_security_alert_router_fakes import (
    ADMIN_USER,
    capture_audit_records,
    make_http_request,
    patch_settings_repository,
)


@pytest.mark.asyncio
async def test_update_security_alert_settings_records_redacted_audit(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "security_alerts_enabled": "false",
            "security_alert_provider": "generic",
        },
    )
    recorded = capture_audit_records(monkeypatch)

    await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="email",
            email_host="smtp.example.com",
            email_port=587,
            email_security="starttls",
            email_username="alerts@example.com",
            email_password="smtp-secret",
            email_from="alerts@example.com",
            email_recipients=["ops@example.com", "admin@example.com"],
            event_routes={
                "login_locked": "default",
                "login_suspicious": "email",
                "login_blocked_ip": "disabled",
            },
            change_alerts_enabled=True,
            automatic_retry_delay_warning_minutes=25,
            change_event_routes={
                "settings_change": "default",
                "service_change": "default",
                "redirect_change": "disabled",
                "middleware_change": "default",
                "user_change": "email",
                "certificate_status_change": "default",
                "certificate_preflight_failure": "disabled",
                "rollback": "disabled",
            },
        ),
        db=object(),
        _=ADMIN_USER,
        http_request=make_http_request(),
    )

    assert recorded[0]["resource_name"] == "보안 알림 설정"
    assert recorded[0]["detail"]["event"] == "settings_update_security_alert"
    assert "email_password" not in recorded[0]["detail"]["summary"]
    assert "email_password" not in recorded[0]["detail"]["after"]
    assert recorded[0]["detail"]["rollback_supported"] is False
    assert "rollback_payload" not in recorded[0]["detail"]
    assert recorded[0]["detail"]["summary"]["provider"] == "email"
    assert recorded[0]["detail"]["summary"]["enabled"] is True
    assert recorded[0]["detail"]["summary"]["email_recipients_count"] == 2
    assert recorded[0]["detail"]["summary"]["event_routes"]["login_blocked_ip"] == "disabled"
    assert recorded[0]["detail"]["summary"]["change_alerts_enabled"] is True
    assert recorded[0]["detail"]["summary"]["automatic_retry_delay_warning_minutes"] == 25
    assert recorded[0]["detail"]["before"]["automatic_retry_delay_warning_minutes"] == 10
    assert recorded[0]["detail"]["after"]["automatic_retry_delay_warning_minutes"] == 25
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["redirect_change"] == "disabled"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["user_change"] == "email"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["certificate_status_change"] == "default"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["certificate_preflight_failure"] == "disabled"
    assert recorded[0]["detail"]["client_ip"] == "198.51.100.7"

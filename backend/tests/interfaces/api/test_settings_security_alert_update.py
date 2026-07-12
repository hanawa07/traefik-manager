import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository
from tests.interfaces.api.settings_security_alert_router_fakes import ADMIN, patch_settings_repository


@pytest.mark.asyncio
async def test_update_security_alert_settings_persists_values(monkeypatch):
    patch_settings_repository(monkeypatch)

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="discord",
            webhook_url=" https://hooks.example.com/security-alerts ",
            telegram_bot_token="tg-secret",
            telegram_chat_id="123456",
            pagerduty_routing_key="pd-secret",
            email_host="smtp.example.com",
            email_from="alerts@example.com",
            email_recipients=["ops@example.com"],
            event_routes={
                "login_locked": "default",
                "login_suspicious": "email",
                "login_blocked_ip": "pagerduty",
            },
            change_alerts_enabled=True,
            change_event_routes={
                "settings_change": "email",
                "service_change": "default",
                "redirect_change": "disabled",
                "middleware_change": "default",
                "user_change": "telegram",
                "certificate_status_change": "email",
                "certificate_preflight_failure": "pagerduty",
                "manager_health": "telegram",
                "rollback": "pagerduty",
            },
        ),
        db=object(),
        _=ADMIN,
    )

    assert StubSettingsRepository.store["security_alerts_enabled"] == "true"
    assert StubSettingsRepository.store["security_alert_provider"] == "discord"
    assert StubSettingsRepository.store["security_alert_webhook_url"] == "https://hooks.example.com/security-alerts"
    assert StubSettingsRepository.store["security_alert_route_login_locked"] == "default"
    assert StubSettingsRepository.store["security_alert_route_login_suspicious"] == "email"
    assert StubSettingsRepository.store["security_alert_route_login_blocked_ip"] == "pagerduty"
    assert StubSettingsRepository.store["change_alerts_enabled"] == "true"
    assert StubSettingsRepository.store["security_alert_change_route_settings_change"] == "email"
    assert StubSettingsRepository.store["security_alert_change_route_redirect_change"] == "disabled"
    assert StubSettingsRepository.store["security_alert_change_route_user_change"] == "telegram"
    assert StubSettingsRepository.store["security_alert_change_route_certificate_status_change"] == "email"
    assert StubSettingsRepository.store["security_alert_change_route_certificate_preflight_failure"] == "pagerduty"
    assert StubSettingsRepository.store["security_alert_change_route_manager_health"] == "telegram"
    assert StubSettingsRepository.store["security_alert_change_route_rollback"] == "pagerduty"
    assert response.enabled is True
    assert response.provider == "discord"
    assert response.webhook_url == "https://hooks.example.com/security-alerts"
    assert response.event_routes["login_suspicious"] == "email"
    assert response.event_routes["login_blocked_ip"] == "pagerduty"
    assert response.change_alerts_enabled is True
    assert response.change_event_routes["settings_change"] == "email"
    assert response.change_event_routes["user_change"] == "telegram"
    assert response.change_event_routes["certificate_status_change"] == "email"
    assert response.change_event_routes["certificate_preflight_failure"] == "pagerduty"
    assert response.change_event_routes["manager_health"] == "telegram"
    assert response.change_event_routes["rollback"] == "pagerduty"


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_telegram_token(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "secret-token",
            "security_alert_telegram_chat_id": "123456",
        },
    )

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="telegram",
            telegram_bot_token="",
            telegram_chat_id="654321",
        ),
        db=object(),
        _=ADMIN,
    )

    assert StubSettingsRepository.store["security_alert_telegram_bot_token"] == "secret-token"
    assert StubSettingsRepository.store["security_alert_telegram_chat_id"] == "654321"
    assert response.provider == "telegram"
    assert response.telegram_bot_token_configured is True
    assert response.telegram_chat_id == "654321"


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_pagerduty_routing_key(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "pagerduty",
            "security_alert_pagerduty_routing_key": "pd-secret",
        },
    )

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="pagerduty",
            pagerduty_routing_key="",
        ),
        db=object(),
        _=ADMIN,
    )

    assert StubSettingsRepository.store["security_alert_pagerduty_routing_key"] == "pd-secret"
    assert response.provider == "pagerduty"
    assert response.pagerduty_routing_key_configured is True


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_email_password(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "email",
            "security_alert_email_host": "smtp.example.com",
            "security_alert_email_port": "587",
            "security_alert_email_security": "starttls",
            "security_alert_email_username": "alerts@example.com",
            "security_alert_email_password": "smtp-secret",
            "security_alert_email_from": "alerts@example.com",
            "security_alert_email_recipients": "ops@example.com\nadmin@example.com",
        },
    )

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="email",
            email_host="smtp.example.com",
            email_port=465,
            email_security="ssl",
            email_username="alerts@example.com",
            email_password="",
            email_from="alerts@example.com",
            email_recipients=["ops@example.com", "admin@example.com"],
        ),
        db=object(),
        _=ADMIN,
    )

    assert StubSettingsRepository.store["security_alert_email_password"] == "smtp-secret"
    assert StubSettingsRepository.store["security_alert_email_port"] == "465"
    assert StubSettingsRepository.store["security_alert_email_security"] == "ssl"
    assert response.provider == "email"
    assert response.email_password_configured is True
    assert response.email_recipients == ["ops@example.com", "admin@example.com"]

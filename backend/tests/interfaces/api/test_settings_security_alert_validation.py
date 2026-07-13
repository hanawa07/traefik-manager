import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsUpdateRequest
from tests.interfaces.api.settings_security_alert_router_fakes import ADMIN, patch_settings_repository


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_telegram_without_token(monkeypatch):
    patch_settings_repository(monkeypatch)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="telegram",
                telegram_bot_token="",
                telegram_chat_id="123456",
            ),
            db=object(),
            _=ADMIN,
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_email_without_required_fields(monkeypatch):
    patch_settings_repository(monkeypatch)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="email",
                email_host="",
                email_port=587,
                email_security="starttls",
                email_username="",
                email_password="",
                email_from="",
                email_recipients=[],
            ),
            db=object(),
            _=ADMIN,
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_pagerduty_without_routing_key(monkeypatch):
    patch_settings_repository(monkeypatch)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="pagerduty",
                pagerduty_routing_key="",
            ),
            db=object(),
            _=ADMIN,
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_override_without_required_config(monkeypatch):
    patch_settings_repository(monkeypatch)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="generic",
                webhook_url="https://hooks.example.com/security-alerts",
                event_routes={
                    "login_locked": "default",
                    "login_suspicious": "default",
                    "login_blocked_ip": "pagerduty",
                },
            ),
            db=object(),
            _=ADMIN,
        )


def test_security_alert_settings_update_request_rejects_invalid_webhook_url():
    with pytest.raises(ValidationError):
        SecurityAlertSettingsUpdateRequest(
            enabled=True,
            webhook_url="ftp://bad.example.com/hook",
        )


def test_security_alert_settings_update_request_rejects_invalid_provider():
    with pytest.raises(ValidationError):
        SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="sms",
            webhook_url="https://hooks.example.com/security-alerts",
        )


@pytest.mark.parametrize("value", [4, 1441])
def test_security_alert_settings_update_request_rejects_invalid_watchdog_stale_minutes(value):
    with pytest.raises(ValidationError):
        SecurityAlertSettingsUpdateRequest(external_watchdog_stale_minutes=value)


def test_security_alert_settings_update_request_normalizes_email_recipients():
    request = SecurityAlertSettingsUpdateRequest(
        enabled=True,
        provider="email",
        email_host="smtp.example.com",
        email_port=587,
        email_security="starttls",
        email_username="alerts@example.com",
        email_password="smtp-secret",
        email_from="alerts@example.com",
        email_recipients=[" ops@example.com ", "admin@example.com"],
    )

    assert request.email_recipients == ["ops@example.com", "admin@example.com"]


def test_security_alert_settings_update_request_normalizes_manager_http_excluded_paths():
    request = SecurityAlertSettingsUpdateRequest(
        manager_http_excluded_paths=[" /api/v1/health/ ", "/api/v1/health", "/api/v1/auth/me"],
    )

    assert request.manager_http_excluded_paths == ["/api/v1/health", "/api/v1/auth/me"]


@pytest.mark.parametrize(
    "path",
    ["/dashboard/missing", "/api/", "/api/v1/health?deep=true", "/api/v1/bad path"],
)
def test_security_alert_settings_update_request_rejects_invalid_excluded_path(path):
    with pytest.raises(ValidationError):
        SecurityAlertSettingsUpdateRequest(manager_http_excluded_paths=[path])

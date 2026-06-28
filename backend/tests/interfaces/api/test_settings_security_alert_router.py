from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import SecurityAlertSettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_get_security_alert_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_security_alert_settings(db=object(), _={"role": "admin"})

    assert response.enabled is False
    assert response.provider == "generic"
    assert response.webhook_url is None
    assert response.telegram_bot_token_configured is False
    assert response.telegram_chat_id is None
    assert response.pagerduty_routing_key_configured is False
    assert response.email_host is None
    assert response.email_port == 587
    assert response.email_security == "starttls"
    assert response.email_username is None
    assert response.email_password_configured is False
    assert response.email_from is None
    assert response.email_recipients == []
    assert response.timeout_seconds == 5.0
    assert response.alert_events == ["login_locked", "login_suspicious", "login_blocked_ip"]
    assert response.event_routes == {
        "login_locked": "default",
        "login_suspicious": "default",
        "login_blocked_ip": "default",
    }
    assert response.change_alerts_enabled is False
    assert response.change_event_routes == {
        "settings_change": "default",
        "service_change": "default",
        "redirect_change": "default",
        "middleware_change": "default",
        "user_change": "default",
        "certificate_status_change": "default",
        "certificate_preflight_failure": "default",
        "rollback": "default",
    }


@pytest.mark.asyncio
async def test_get_security_alert_settings_maps_legacy_certificate_route(monkeypatch):
    StubSettingsRepository.store = {
        "change_alerts_enabled": "true",
        "security_alert_change_route_certificate_change": "email",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_security_alert_settings(db=object(), _={"role": "admin"})

    assert response.change_event_routes["certificate_status_change"] == "email"
    assert response.change_event_routes["certificate_preflight_failure"] == "email"


@pytest.mark.asyncio
async def test_update_security_alert_settings_persists_values(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

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
                "rollback": "pagerduty",
            },
        ),
        db=object(),
        _={"role": "admin"},
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
    assert response.change_event_routes["rollback"] == "pagerduty"


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_telegram_token(monkeypatch):
    StubSettingsRepository.store = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "telegram",
        "security_alert_telegram_bot_token": "secret-token",
        "security_alert_telegram_chat_id": "123456",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="telegram",
            telegram_bot_token="",
            telegram_chat_id="654321",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["security_alert_telegram_bot_token"] == "secret-token"
    assert StubSettingsRepository.store["security_alert_telegram_chat_id"] == "654321"
    assert response.provider == "telegram"
    assert response.telegram_bot_token_configured is True
    assert response.telegram_chat_id == "654321"


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_pagerduty_routing_key(monkeypatch):
    StubSettingsRepository.store = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "pagerduty",
        "security_alert_pagerduty_routing_key": "pd-secret",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="pagerduty",
            pagerduty_routing_key="",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["security_alert_pagerduty_routing_key"] == "pd-secret"
    assert response.provider == "pagerduty"
    assert response.pagerduty_routing_key_configured is True


@pytest.mark.asyncio
async def test_update_security_alert_settings_keeps_existing_email_password(monkeypatch):
    StubSettingsRepository.store = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "email",
        "security_alert_email_host": "smtp.example.com",
        "security_alert_email_port": "587",
        "security_alert_email_security": "starttls",
        "security_alert_email_username": "alerts@example.com",
        "security_alert_email_password": "smtp-secret",
        "security_alert_email_from": "alerts@example.com",
        "security_alert_email_recipients": "ops@example.com\nadmin@example.com",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

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
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["security_alert_email_password"] == "smtp-secret"
    assert StubSettingsRepository.store["security_alert_email_port"] == "465"
    assert StubSettingsRepository.store["security_alert_email_security"] == "ssl"
    assert response.provider == "email"
    assert response.email_password_configured is True
    assert response.email_recipients == ["ops@example.com", "admin@example.com"]


@pytest.mark.asyncio
async def test_update_security_alert_settings_records_redacted_audit(monkeypatch):
    StubSettingsRepository.store = {
        "security_alerts_enabled": "false",
        "security_alert_provider": "generic",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "198.51.100.7")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

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
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
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
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["redirect_change"] == "disabled"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["user_change"] == "email"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["certificate_status_change"] == "default"
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["certificate_preflight_failure"] == "disabled"
    assert recorded[0]["detail"]["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_telegram_without_token(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="telegram",
                telegram_bot_token="",
                telegram_chat_id="123456",
            ),
            db=object(),
            _={"role": "admin"},
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_email_without_required_fields(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

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
            _={"role": "admin"},
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_enabled_pagerduty_without_routing_key(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    with pytest.raises(HTTPException):
        await settings_router.update_security_alert_settings(
            request=SecurityAlertSettingsUpdateRequest(
                enabled=True,
                provider="pagerduty",
                pagerduty_routing_key="",
            ),
            db=object(),
            _={"role": "admin"},
        )


@pytest.mark.asyncio
async def test_update_security_alert_settings_rejects_override_without_required_config(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

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
            _={"role": "admin"},
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


@pytest.mark.asyncio
async def test_test_security_alert_settings_returns_success(monkeypatch):
    StubSettingsRepository.store = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    called = {}
    recorded = []

    async def fake_send_test_alert(db):
        called["db"] = db
        return {
            "success": True,
            "provider": "slack",
            "message": "테스트 보안 알림을 전송했습니다",
            "detail": "Slack webhook으로 테스트 payload를 전송했습니다",
        }

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.security_alert_notifier, "send_test_alert", fake_send_test_alert)
    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "198.51.100.7")

    db = object()

    response = await settings_router.test_security_alert_settings(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=db,
        _={"role": "admin", "username": "admin"},
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

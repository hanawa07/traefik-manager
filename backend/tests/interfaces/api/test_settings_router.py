import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from types import SimpleNamespace
from datetime import datetime, timezone

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsUpdateRequest,
    SecurityAlertSettingsUpdateRequest,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsUpdateRequest,
)


class StubSettingsRepository:
    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str | None) -> None:
        if value is None:
            self.store.pop(key, None)
        else:
            self.store[key] = value


@pytest.mark.asyncio
async def test_get_time_display_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(
        settings_router,
        "get_server_time_context",
        lambda: {
            "storage_timezone": "UTC",
            "server_timezone_name": "KST",
            "server_timezone_label": "KST",
            "server_timezone_offset": "+09:00",
            "server_time_iso": "2026-03-10T22:40:48+09:00",
        },
    )

    response = await settings_router.get_time_display_settings(db=object(), _={"role": "admin"})

    assert response.display_timezone == "Asia/Seoul"
    assert response.display_timezone_name == "Asia/Seoul"
    assert response.storage_timezone == "UTC"
    assert response.server_timezone_offset == "+09:00"


@pytest.mark.asyncio
async def test_update_time_display_settings_persists_value(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(
        settings_router,
        "get_server_time_context",
        lambda: {
            "storage_timezone": "UTC",
            "server_timezone_name": "KST",
            "server_timezone_label": "KST",
            "server_timezone_offset": "+09:00",
            "server_time_iso": "2026-03-10T22:40:48+09:00",
        },
    )

    response = await settings_router.update_time_display_settings(
        request=TimeDisplaySettingsUpdateRequest(display_timezone="America/New_York"),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["display_timezone"] == "America/New_York"
    assert response.display_timezone == "America/New_York"
    assert response.display_timezone_name == "America/New_York"


@pytest.mark.asyncio
async def test_update_time_display_settings_records_audit(monkeypatch):
    StubSettingsRepository.store = {"display_timezone": "Asia/Seoul"}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(
        settings_router,
        "get_server_time_context",
        lambda: {
            "storage_timezone": "UTC",
            "server_timezone_name": "UTC",
            "server_timezone_label": "UTC",
            "server_timezone_offset": "+00:00",
            "server_time_iso": "2026-03-12T00:00:00+00:00",
        },
    )
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.10")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

    await settings_router.update_time_display_settings(
        request=TimeDisplaySettingsUpdateRequest(display_timezone="America/New_York"),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
    )

    assert recorded[0]["action"] == "update"
    assert recorded[0]["resource_type"] == "settings"
    assert recorded[0]["resource_name"] == "시간 표시 설정"
    assert recorded[0]["detail"]["event"] == "settings_update_time_display"
    assert recorded[0]["detail"]["changed_keys"] == ["display_timezone"]
    assert recorded[0]["detail"]["summary"]["display_timezone"] == "America/New_York"
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.10"


@pytest.mark.asyncio
async def test_get_upstream_security_settings_returns_default(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_upstream_security_settings(db=object(), _={"role": "admin"})

    assert response.dns_strict_mode is False
    assert response.allowlist_enabled is False
    assert response.allowed_domain_suffixes == []
    assert response.allow_docker_service_names is True
    assert response.allow_private_networks is True
    assert response.preset_key == "disabled"
    assert response.preset_name == "정책 비활성화"
    assert [preset.key for preset in response.available_presets] == [
        "disabled",
        "internal-first",
        "external-only",
    ]


@pytest.mark.asyncio
async def test_update_upstream_security_settings_persists_value(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_upstream_security_settings(
        request=UpstreamSecuritySettingsUpdateRequest(
            dns_strict_mode=True,
            allowlist_enabled=True,
            allowed_domain_suffixes=["Example.com", " api.example.org "],
            allow_docker_service_names=False,
            allow_private_networks=False,
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["upstream_dns_strict_mode"] == "true"
    assert StubSettingsRepository.store["upstream_allowlist_enabled"] == "true"
    assert StubSettingsRepository.store["upstream_allowed_domain_suffixes"] == "example.com\napi.example.org"
    assert StubSettingsRepository.store["upstream_allow_docker_service_names"] == "false"
    assert StubSettingsRepository.store["upstream_allow_private_networks"] == "false"
    assert response.dns_strict_mode is True
    assert response.allowlist_enabled is True
    assert response.allowed_domain_suffixes == ["example.com", "api.example.org"]
    assert response.allow_docker_service_names is False
    assert response.allow_private_networks is False
    assert response.preset_key == "external-only"
    assert response.preset_name == "외부 승인 도메인 전용"


@pytest.mark.asyncio
async def test_get_login_defense_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_login_defense_settings(db=object(), _={"role": "admin"})

    assert response.suspicious_block_enabled is True
    assert response.suspicious_trusted_networks == []
    assert response.suspicious_block_minutes == 30
    assert response.suspicious_block_escalation_enabled is False
    assert response.suspicious_block_escalation_window_minutes == 1440
    assert response.suspicious_block_escalation_multiplier == 2
    assert response.suspicious_block_max_minutes == 1440
    assert response.failure_window_minutes == 15
    assert response.turnstile_mode == "off"
    assert response.turnstile_enabled is False
    assert response.turnstile_site_key is None
    assert response.turnstile_secret_key_configured is False


@pytest.mark.asyncio
async def test_update_login_defense_settings_persists_values(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=False,
            suspicious_trusted_networks=["10.0.0.0/8", "203.0.113.10/32"],
            suspicious_block_escalation_enabled=True,
            suspicious_block_escalation_window_minutes=720,
            suspicious_block_escalation_multiplier=3,
            suspicious_block_max_minutes=2880,
            turnstile_mode="always",
            turnstile_site_key=" 0x4AAAAA-example-site-key ",
            turnstile_secret_key=" secret-turnstile-key ",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_mode"] == "always"
    assert StubSettingsRepository.store["login_suspicious_block_enabled"] == "false"
    assert StubSettingsRepository.store["login_suspicious_trusted_networks"] == "10.0.0.0/8\n203.0.113.10/32"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_enabled"] == "true"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_window_minutes"] == "720"
    assert StubSettingsRepository.store["login_suspicious_block_escalation_multiplier"] == "3"
    assert StubSettingsRepository.store["login_suspicious_block_max_minutes"] == "2880"
    assert StubSettingsRepository.store["login_turnstile_enabled"] == "true"
    assert StubSettingsRepository.store["login_turnstile_site_key"] == "0x4AAAAA-example-site-key"
    assert StubSettingsRepository.store["login_turnstile_secret_key"] == "secret-turnstile-key"
    assert response.suspicious_block_enabled is False
    assert response.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32"]
    assert response.suspicious_block_escalation_enabled is True
    assert response.suspicious_block_escalation_window_minutes == 720
    assert response.suspicious_block_escalation_multiplier == 3
    assert response.suspicious_block_max_minutes == 2880
    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True
    assert response.turnstile_site_key == "0x4AAAAA-example-site-key"
    assert response.turnstile_secret_key_configured is True


@pytest.mark.asyncio
async def test_update_login_defense_settings_keeps_existing_turnstile_secret(monkeypatch):
    StubSettingsRepository.store = {
        "login_turnstile_mode": "always",
        "login_turnstile_enabled": "true",
        "login_turnstile_site_key": "0x4AAAAA-existing-site-key",
        "login_turnstile_secret_key": "existing-secret",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="always",
            turnstile_site_key="0x4AAAAA-new-site-key",
            turnstile_secret_key="",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_secret_key"] == "existing-secret"
    assert StubSettingsRepository.store["login_turnstile_mode"] == "always"
    assert response.turnstile_site_key == "0x4AAAAA-new-site-key"
    assert response.turnstile_secret_key_configured is True


@pytest.mark.asyncio
async def test_get_login_defense_settings_uses_legacy_turnstile_flag_when_mode_missing(monkeypatch):
    StubSettingsRepository.store = {
        "login_turnstile_enabled": "true",
        "login_turnstile_site_key": "0x4AAAAA-existing-site-key",
        "login_turnstile_secret_key": "existing-secret",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_login_defense_settings(db=object(), _={"role": "admin"})

    assert response.turnstile_mode == "always"
    assert response.turnstile_enabled is True


@pytest.mark.asyncio
async def test_update_login_defense_settings_persists_risk_based_mode(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="risk_based",
            turnstile_site_key="0x4AAAAA-risk-site-key",
            turnstile_secret_key="risk-secret-key",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_turnstile_mode"] == "risk_based"
    assert StubSettingsRepository.store["login_turnstile_enabled"] == "true"
    assert response.turnstile_mode == "risk_based"
    assert response.turnstile_enabled is True


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


@pytest.mark.asyncio
async def test_update_security_alert_settings_persists_values(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_security_alert_settings(
        request=SecurityAlertSettingsUpdateRequest(
            enabled=True,
            provider="discord",
            webhook_url=" https://hooks.example.com/security-alerts ",
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["security_alerts_enabled"] == "true"
    assert StubSettingsRepository.store["security_alert_provider"] == "discord"
    assert StubSettingsRepository.store["security_alert_webhook_url"] == "https://hooks.example.com/security-alerts"
    assert response.enabled is True
    assert response.provider == "discord"
    assert response.webhook_url == "https://hooks.example.com/security-alerts"


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
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
    )

    assert recorded[0]["resource_name"] == "보안 알림 설정"
    assert recorded[0]["detail"]["event"] == "settings_update_security_alert"
    assert "email_password" not in recorded[0]["detail"]["summary"]
    assert recorded[0]["detail"]["summary"]["provider"] == "email"
    assert recorded[0]["detail"]["summary"]["enabled"] is True
    assert recorded[0]["detail"]["summary"]["email_recipients_count"] == 2
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


def test_time_display_settings_update_request_rejects_invalid_value():
    with pytest.raises(ValidationError):
        TimeDisplaySettingsUpdateRequest(display_timezone="Mars/Base")


def test_upstream_security_settings_update_request_normalizes_domain_suffixes():
    request = UpstreamSecuritySettingsUpdateRequest(
        dns_strict_mode=False,
        allowlist_enabled=True,
        allowed_domain_suffixes=[" Example.com ", "*.api.example.org", ".deep.example.net"],
        allow_docker_service_names=True,
        allow_private_networks=True,
    )

    assert request.allowed_domain_suffixes == ["example.com", "api.example.org", "deep.example.net"]


def test_upstream_security_settings_update_request_rejects_invalid_domain_suffix():
    with pytest.raises(ValidationError):
        UpstreamSecuritySettingsUpdateRequest(
            dns_strict_mode=False,
            allowlist_enabled=True,
            allowed_domain_suffixes=["bad suffix!"],
            allow_docker_service_names=True,
            allow_private_networks=True,
        )


def test_login_defense_settings_update_request_normalizes_trusted_networks():
    request = LoginDefenseSettingsUpdateRequest(
        suspicious_block_enabled=True,
        suspicious_trusted_networks=[" 10.0.0.0/8 ", "203.0.113.10", "2001:db8::/64"],
        suspicious_block_escalation_enabled=True,
        suspicious_block_escalation_window_minutes=720,
        suspicious_block_escalation_multiplier=3,
        suspicious_block_max_minutes=2880,
        turnstile_mode="risk_based",
    )

    assert request.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32", "2001:db8::/64"]


def test_login_defense_settings_update_request_rejects_invalid_trusted_network():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=["bad-network"],
        )


def test_login_defense_settings_update_request_rejects_invalid_turnstile_mode():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            turnstile_mode="sometimes",
        )


def test_login_defense_settings_update_request_rejects_invalid_escalation_multiplier():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=[],
            suspicious_block_escalation_enabled=True,
            suspicious_block_escalation_window_minutes=720,
            suspicious_block_escalation_multiplier=1,
            suspicious_block_max_minutes=1440,
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
async def test_test_cloudflare_connection_returns_success(monkeypatch):
    recorded = []

    class StubCloudflareClient:
        async def test_connection(self):
            return {
                "success": True,
                "message": "Cloudflare 연결에 성공했습니다",
                "detail": "example.com 영역에 접근할 수 있습니다",
            }

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.10")

    response = await settings_router.test_cloudflare_connection(
        request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=object(),
        cloudflare_client=StubCloudflareClient(),
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


@pytest.mark.asyncio
async def test_get_settings_test_history_returns_latest_cloudflare_and_security_alert_events(monkeypatch):
    now = datetime.now(timezone.utc)
    logs = [
        SimpleNamespace(
            id="1",
            actor="admin",
            action="test",
            resource_type="settings",
            resource_id="settings_test_cloudflare",
            resource_name="Cloudflare 연결 테스트",
            detail={"event": "settings_test_cloudflare", "success": True, "message": "성공"},
            created_at=now,
        ),
        SimpleNamespace(
            id="2",
            actor="admin",
            action="test",
            resource_type="settings",
            resource_id="settings_test_security_alert",
            resource_name="보안 알림 테스트",
            detail={"event": "settings_test_security_alert", "success": False, "message": "실패", "provider": "slack"},
            created_at=now,
        ),
    ]

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

    class StubDB:
        async def execute(self, _query):
            return StubExecuteResult(logs)

    response = await settings_router.get_settings_test_history(db=StubDB(), _={"role": "admin"})

    assert response.cloudflare.last_event == "settings_test_cloudflare"
    assert response.cloudflare.last_success is True
    assert response.cloudflare.last_message == "성공"
    assert response.security_alert.last_event == "settings_test_security_alert"
    assert response.security_alert.last_success is False
    assert response.security_alert.last_provider == "slack"

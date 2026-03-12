import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsUpdateRequest,
    TraefikDashboardSettingsUpdateRequest,
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


class RecordingDashboardFileWriter:
    def __init__(self):
        self.write_calls = []
        self.deleted = False

    def write_traefik_dashboard_public_route(self, domain, basic_auth_username, basic_auth_password_hash):
        self.write_calls.append((domain, basic_auth_username, basic_auth_password_hash))

    def delete_traefik_dashboard_public_route(self):
        self.deleted = True


class StubDomainRepository:
    domain_result = None

    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return self.domain_result


class StubNoConflictRepository:
    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return None


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


class StubAuditHistoryDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


def make_audit_log(
    *,
    event: str,
    created_at: datetime,
    success: bool | None = None,
    message: str | None = None,
    detail: str | None = None,
    provider: str | None = None,
):
    payload: dict[str, object] = {"event": event}
    if success is not None:
        payload["success"] = success
    if message is not None:
        payload["message"] = message
    if detail is not None:
        payload["detail"] = detail
    if provider is not None:
        payload["provider"] = provider
    return SimpleNamespace(
        id="audit-log-id",
        actor="system",
        action="alert" if "delivery" in event else "test",
        resource_type="settings",
        resource_id="settings-audit",
        resource_name="설정 테스트",
        detail=payload,
        created_at=created_at,
    )


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
    assert recorded[0]["detail"]["before"]["display_timezone"] == "Asia/Seoul"
    assert recorded[0]["detail"]["after"]["display_timezone"] == "America/New_York"
    assert recorded[0]["detail"]["rollback_supported"] is True
    assert recorded[0]["detail"]["rollback_payload"] == {"display_timezone": "Asia/Seoul"}
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
async def test_get_traefik_dashboard_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.get_traefik_dashboard_settings(db=object(), _={"role": "admin"})

    assert response.enabled is False
    assert response.configured is False
    assert response.domain is None
    assert response.auth_username is None
    assert response.auth_password_configured is False


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_persists_and_writes_file(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubNoConflictRepository)
    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubNoConflictRepository)
    writer = RecordingDashboardFileWriter()
    monkeypatch.setattr(settings_router, "FileProviderWriter", lambda: writer)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.10")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

    response = await settings_router.update_traefik_dashboard_settings(
        request=TraefikDashboardSettingsUpdateRequest(
            enabled=True,
            domain="traefik-debug.example.com",
            auth_username="debug-admin",
            auth_password="super-secret-password",
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
    )

    assert response.enabled is True
    assert response.configured is True
    assert response.domain == "traefik-debug.example.com"
    assert response.auth_username == "debug-admin"
    assert response.auth_password_configured is True
    assert StubSettingsRepository.store["traefik_dashboard_public_enabled"] == "true"
    assert StubSettingsRepository.store["traefik_dashboard_public_domain"] == "traefik-debug.example.com"
    assert StubSettingsRepository.store["traefik_dashboard_public_auth_username"] == "debug-admin"
    assert "super-secret-password" not in StubSettingsRepository.store["traefik_dashboard_public_auth_password_hash"]
    assert writer.write_calls[0][0] == "traefik-debug.example.com"
    assert writer.write_calls[0][1] == "debug-admin"
    assert writer.deleted is False
    assert recorded[0]["detail"]["event"] == "settings_update_traefik_dashboard"
    assert recorded[0]["detail"]["after"]["enabled"] is True
    assert recorded[0]["detail"]["after"]["domain"] == "traefik-debug.example.com"
    assert recorded[0]["detail"]["after"]["auth_username"] == "debug-admin"
    assert recorded[0]["detail"]["after"]["auth_password_configured"] is True
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.10"


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_keeps_existing_password_when_blank(monkeypatch):
    StubSettingsRepository.store = {
        "traefik_dashboard_public_enabled": "true",
        "traefik_dashboard_public_domain": "traefik-debug.example.com",
        "traefik_dashboard_public_auth_username": "debug-admin",
        "traefik_dashboard_public_auth_password_hash": "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubNoConflictRepository)
    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubNoConflictRepository)
    writer = RecordingDashboardFileWriter()
    monkeypatch.setattr(settings_router, "FileProviderWriter", lambda: writer)

    await settings_router.update_traefik_dashboard_settings(
        request=TraefikDashboardSettingsUpdateRequest(
            enabled=True,
            domain="traefik-debug.example.com",
            auth_username="debug-admin",
            auth_password="",
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
    )

    assert StubSettingsRepository.store["traefik_dashboard_public_auth_password_hash"] == "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m"
    assert writer.write_calls[0][2] == "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m"


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_requires_password_on_first_enable(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubNoConflictRepository)
    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubNoConflictRepository)

    with pytest.raises(HTTPException) as exc_info:
        await settings_router.update_traefik_dashboard_settings(
            request=TraefikDashboardSettingsUpdateRequest(
                enabled=True,
                domain="traefik-debug.example.com",
                auth_username="debug-admin",
                auth_password="",
            ),
            db=object(),
            _={"role": "admin", "username": "admin"},
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "처음 활성화할 때는 기본 인증 비밀번호가 필요합니다"


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_rejects_url_style_domain():
    with pytest.raises(ValidationError) as exc_info:
        TraefikDashboardSettingsUpdateRequest(
            enabled=True,
            domain="https://traefik-debug.example.com",
            auth_username="debug-admin",
            auth_password="secret",
        )

    assert "https:// 없이 공개 도메인만 입력해야 합니다" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_rejects_service_domain_conflict(monkeypatch):
    StubSettingsRepository.store = {}
    StubDomainRepository.domain_result = SimpleNamespace(domain="traefik.example.com")
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubDomainRepository)

    class StubRedirectRepository:
        def __init__(self, _db):
            pass

        async def find_by_domain(self, _domain: str):
            return None

    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubRedirectRepository)

    with pytest.raises(HTTPException) as exc_info:
        await settings_router.update_traefik_dashboard_settings(
            request=TraefikDashboardSettingsUpdateRequest(
                enabled=True,
                domain="traefik.example.com",
                auth_username="debug-admin",
                auth_password="secret",
            ),
            db=object(),
            _={"role": "admin", "username": "admin"},
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "이미 서비스에서 사용 중인 도메인입니다. 다른 공개 도메인을 사용해야 합니다."


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_rejects_redirect_domain_conflict(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    class StubServiceRepository:
        def __init__(self, _db):
            pass

        async def find_by_domain(self, _domain: str):
            return None

    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubServiceRepository)

    class StubRedirectRepository:
        def __init__(self, _session):
            pass

        async def find_by_domain(self, _domain: str):
            return SimpleNamespace(domain="traefik.example.com")

    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubRedirectRepository)

    with pytest.raises(HTTPException) as exc_info:
        await settings_router.update_traefik_dashboard_settings(
            request=TraefikDashboardSettingsUpdateRequest(
                enabled=True,
                domain="traefik.example.com",
                auth_username="debug-admin",
                auth_password="secret",
            ),
            db=object(),
            _={"role": "admin", "username": "admin"},
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "이미 리다이렉트에서 사용 중인 도메인입니다. 다른 공개 도메인을 사용해야 합니다."


@pytest.mark.asyncio
async def test_update_traefik_dashboard_settings_deletes_file_when_disabled(monkeypatch):
    StubSettingsRepository.store = {
        "traefik_dashboard_public_enabled": "true",
        "traefik_dashboard_public_domain": "traefik-debug.example.com",
        "traefik_dashboard_public_auth_username": "debug-admin",
        "traefik_dashboard_public_auth_password_hash": "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "SQLiteServiceRepository", StubNoConflictRepository)
    monkeypatch.setattr(settings_router, "SQLiteRedirectHostRepository", StubNoConflictRepository)
    writer = RecordingDashboardFileWriter()
    monkeypatch.setattr(settings_router, "FileProviderWriter", lambda: writer)

    response = await settings_router.update_traefik_dashboard_settings(
        request=TraefikDashboardSettingsUpdateRequest(
            enabled=False,
            domain="traefik-debug.example.com",
            auth_username="debug-admin",
            auth_password="",
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
    )

    assert response.enabled is False
    assert StubSettingsRepository.store["traefik_dashboard_public_enabled"] == "false"
    assert writer.deleted is True


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
async def test_get_settings_test_history_includes_delivery_summary():
    now = datetime.now(timezone.utc)
    db = StubAuditHistoryDb(
        [
            make_audit_log(
                event="security_alert_delivery_failure",
                success=False,
                message="전송 실패",
                detail="network down",
                provider="slack",
                created_at=now - timedelta(minutes=5),
            ),
            make_audit_log(
                event="security_alert_delivery_success",
                success=True,
                message="전송 성공",
                detail="slack 채널로 전송했습니다",
                provider="slack",
                created_at=now - timedelta(minutes=10),
            ),
            make_audit_log(
                event="security_alert_delivery_failure",
                success=False,
                message="이전 실패",
                detail="timeout",
                provider="slack",
                created_at=now - timedelta(hours=2),
            ),
        ]
    )

    response = await settings_router.get_settings_test_history(
        db=db,
        _={"role": "admin"},
    )

    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_success is False
    assert response.security_alert_delivery.last_failure_message == "전송 실패"
    assert response.security_alert_delivery.last_failure_detail == "network down"
    assert response.security_alert_delivery.last_failure_provider == "slack"
    assert response.security_alert_delivery.last_success_at == now - timedelta(minutes=10)
    assert response.security_alert_delivery.last_failure_at == now - timedelta(minutes=5)
    assert response.security_alert_delivery.recent_failure_count == 2


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
        "certificate_change": "default",
        "rollback": "default",
    }


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
                "certificate_change": "email",
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
    assert StubSettingsRepository.store["security_alert_change_route_certificate_change"] == "email"
    assert StubSettingsRepository.store["security_alert_change_route_rollback"] == "pagerduty"
    assert response.enabled is True
    assert response.provider == "discord"
    assert response.webhook_url == "https://hooks.example.com/security-alerts"
    assert response.event_routes["login_suspicious"] == "email"
    assert response.event_routes["login_blocked_ip"] == "pagerduty"
    assert response.change_alerts_enabled is True
    assert response.change_event_routes["settings_change"] == "email"
    assert response.change_event_routes["user_change"] == "telegram"
    assert response.change_event_routes["certificate_change"] == "email"
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
                "certificate_change": "default",
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
    assert recorded[0]["detail"]["summary"]["change_event_routes"]["certificate_change"] == "default"
    assert recorded[0]["detail"]["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_rollback_settings_change_restores_time_display(monkeypatch):
    StubSettingsRepository.store = {"display_timezone": "America/New_York"}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.15")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    class StubScalarResult:
        def __init__(self, item):
            self._item = item

        def scalar_one_or_none(self):
            return self._item

    class StubExecuteResult:
        def __init__(self, item):
            self._item = item

        def scalars(self):
            return self

        def all(self):
            return [self._item] if self._item else []

        def scalar_one_or_none(self):
            return self._item

    class StubDB:
        def __init__(self, item):
            self.item = item

        async def execute(self, _query):
            return StubExecuteResult(self.item)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

    response = await settings_router.rollback_settings_change(
        audit_log_id="log-1",
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=StubDB(
            SimpleNamespace(
                id="log-1",
                actor="admin",
                action="update",
                resource_type="settings",
                resource_id="settings_update_time_display",
                resource_name="시간 표시 설정",
                detail={
                    "event": "settings_update_time_display",
                    "rollback_supported": True,
                    "rollback_payload": {"display_timezone": "Asia/Seoul"},
                    "before": {"display_timezone": "Asia/Seoul"},
                    "after": {"display_timezone": "America/New_York"},
                },
                created_at=datetime.now(timezone.utc),
            )
        ),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert StubSettingsRepository.store["display_timezone"] == "Asia/Seoul"
    assert recorded[0]["action"] == "rollback"
    assert recorded[0]["resource_type"] == "settings"
    assert recorded[0]["resource_name"] == "시간 표시 설정"
    assert recorded[0]["detail"]["event"] == "settings_rollback_time_display"
    assert recorded[0]["detail"]["source_audit_id"] == "log-1"
    assert recorded[0]["detail"]["before"]["display_timezone"] == "America/New_York"
    assert recorded[0]["detail"]["after"]["display_timezone"] == "Asia/Seoul"
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.15"


@pytest.mark.asyncio
async def test_rollback_settings_change_restores_upstream_security(monkeypatch):
    StubSettingsRepository.store = {
        "upstream_dns_strict_mode": "true",
        "upstream_allowlist_enabled": "true",
        "upstream_allowed_domain_suffixes": "example.com",
        "upstream_allow_docker_service_names": "false",
        "upstream_allow_private_networks": "false",
    }
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    class StubExecuteResult:
        def __init__(self, item):
            self._item = item

        def scalar_one_or_none(self):
            return self._item

    class StubDB:
        def __init__(self, item):
            self.item = item

        async def execute(self, _query):
            return StubExecuteResult(self.item)

    response = await settings_router.rollback_settings_change(
        audit_log_id="log-2",
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
        db=StubDB(
            SimpleNamespace(
                id="log-2",
                actor="admin",
                action="update",
                resource_type="settings",
                resource_id="settings_update_upstream_security",
                resource_name="업스트림 보안 설정",
                detail={
                    "event": "settings_update_upstream_security",
                    "rollback_supported": True,
                    "rollback_payload": {
                        "dns_strict_mode": False,
                        "allowlist_enabled": False,
                        "allowed_domain_suffixes": [],
                        "allow_docker_service_names": True,
                        "allow_private_networks": True,
                    },
                    "before": {"preset_key": "disabled"},
                    "after": {"preset_key": "external-only"},
                },
                created_at=datetime.now(timezone.utc),
            )
        ),
        _={"role": "admin", "username": "admin"},
    )

    assert response.success is True
    assert StubSettingsRepository.store["upstream_dns_strict_mode"] == "false"
    assert StubSettingsRepository.store["upstream_allowlist_enabled"] == "false"
    assert StubSettingsRepository.store["upstream_allowed_domain_suffixes"] == ""
    assert StubSettingsRepository.store["upstream_allow_docker_service_names"] == "true"
    assert StubSettingsRepository.store["upstream_allow_private_networks"] == "true"


@pytest.mark.asyncio
async def test_rollback_settings_change_rejects_unsupported_event(monkeypatch):
    class StubExecuteResult:
        def __init__(self, item):
            self._item = item

        def scalar_one_or_none(self):
            return self._item

    class StubDB:
        def __init__(self, item):
            self.item = item

        async def execute(self, _query):
            return StubExecuteResult(self.item)

    with pytest.raises(HTTPException):
        await settings_router.rollback_settings_change(
            audit_log_id="log-3",
            http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
            db=StubDB(
                SimpleNamespace(
                    id="log-3",
                    actor="admin",
                    action="update",
                    resource_type="settings",
                    resource_id="settings_update_security_alert",
                    resource_name="보안 알림 설정",
                    detail={
                        "event": "settings_update_security_alert",
                        "rollback_supported": False,
                        "before": {"enabled": False},
                        "after": {"enabled": True},
                    },
                    created_at=datetime.now(timezone.utc),
                )
            ),
            _={"role": "admin", "username": "admin"},
        )


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
        SimpleNamespace(
            id="3",
            actor="system",
            action="alert",
            resource_type="settings",
            resource_id="security-alert-delivery",
            resource_name="보안 알림 전송 결과",
            detail={
                "event": "security_alert_delivery_failure",
                "success": False,
                "message": "이상 징후 로그인 감지: 1.2.3.4",
                "detail": "network down",
                "provider": "slack",
                "source_event": "login_suspicious",
            },
            created_at=now,
        ),
        SimpleNamespace(
            id="4",
            actor="system",
            action="alert",
            resource_type="settings",
            resource_id="change-alert-delivery",
            resource_name="운영 변경 알림 전송 결과",
            detail={
                "event": "change_alert_delivery_success",
                "success": True,
                "message": "서비스 변경: svc",
                "detail": "pagerduty 채널로 전송했습니다",
                "provider": "pagerduty",
                "source_event": "service_update",
            },
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
    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_success is False
    assert response.security_alert_delivery.last_provider == "slack"
    assert response.security_alert_delivery.last_detail == "network down"
    assert response.change_alert_delivery.last_event == "change_alert_delivery_success"
    assert response.change_alert_delivery.last_success is True
    assert response.change_alert_delivery.last_provider == "pagerduty"


@pytest.mark.asyncio
async def test_get_settings_test_history_accepts_naive_created_at():
    now = datetime.now(timezone.utc)
    logs = [
        SimpleNamespace(
            id="1",
            actor="system",
            action="alert",
            resource_type="settings",
            resource_id="security-alert-delivery",
            resource_name="보안 알림 전송 결과",
            detail={
                "event": "security_alert_delivery_failure",
                "success": False,
                "message": "이상 징후 로그인 감지: 1.2.3.4",
                "detail": "network down",
                "provider": "slack",
                "source_event": "login_suspicious",
            },
            created_at=(now - timedelta(minutes=5)).replace(tzinfo=None),
        ),
        SimpleNamespace(
            id="2",
            actor="system",
            action="alert",
            resource_type="settings",
            resource_id="change-alert-delivery",
            resource_name="운영 변경 알림 전송 결과",
            detail={
                "event": "change_alert_delivery_success",
                "success": True,
                "message": "서비스 변경: svc",
                "detail": "pagerduty 채널로 전송했습니다",
                "provider": "pagerduty",
                "source_event": "service_update",
            },
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

    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_failure_at is not None
    assert response.security_alert_delivery.last_failure_at.tzinfo is not None
    assert response.security_alert_delivery.recent_failure_count == 1

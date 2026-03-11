import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
    LoginDefenseSettingsUpdateRequest,
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
    assert response.failure_window_minutes == 15


@pytest.mark.asyncio
async def test_update_login_defense_settings_persists_values(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    response = await settings_router.update_login_defense_settings(
        request=LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=False,
            suspicious_trusted_networks=["10.0.0.0/8", "203.0.113.10/32"],
        ),
        db=object(),
        _={"role": "admin"},
    )

    assert StubSettingsRepository.store["login_suspicious_block_enabled"] == "false"
    assert StubSettingsRepository.store["login_suspicious_trusted_networks"] == "10.0.0.0/8\n203.0.113.10/32"
    assert response.suspicious_block_enabled is False
    assert response.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32"]


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
    )

    assert request.suspicious_trusted_networks == ["10.0.0.0/8", "203.0.113.10/32", "2001:db8::/64"]


def test_login_defense_settings_update_request_rejects_invalid_trusted_network():
    with pytest.raises(ValidationError):
        LoginDefenseSettingsUpdateRequest(
            suspicious_block_enabled=True,
            suspicious_trusted_networks=["bad-network"],
        )

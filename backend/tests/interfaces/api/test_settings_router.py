import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
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

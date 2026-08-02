import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import UpstreamSecuritySettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


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

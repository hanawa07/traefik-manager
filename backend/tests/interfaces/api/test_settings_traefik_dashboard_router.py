from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import TraefikDashboardSettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import (
    RecordingDashboardFileWriter,
    StubDomainRepository,
    StubNoConflictRepository,
    StubSettingsRepository,
)


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

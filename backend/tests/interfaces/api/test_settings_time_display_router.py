from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import TimeDisplaySettingsUpdateRequest
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


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


def test_time_display_settings_update_request_rejects_invalid_value():
    with pytest.raises(ValidationError):
        TimeDisplaySettingsUpdateRequest(display_timezone="Mars/Base")

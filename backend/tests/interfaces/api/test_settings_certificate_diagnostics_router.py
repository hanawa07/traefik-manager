from types import SimpleNamespace

import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsUpdateRequest,
)
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_get_certificate_diagnostics_settings_returns_defaults(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_MINUTES", 60)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 240)

    response = await settings_router.get_certificate_diagnostics_settings(db=object(), _={"role": "admin"})

    assert response.auto_check_interval_minutes == 60
    assert response.repeat_alert_threshold == 3
    assert response.repeat_alert_window_minutes == 240
    assert response.repeat_alert_cooldown_minutes == 240


@pytest.mark.asyncio
async def test_update_certificate_diagnostics_settings_persists_and_records_audit(monkeypatch):
    StubSettingsRepository.store = {}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.11")
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_MINUTES", 60)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(settings_router.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 240)
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

    response = await settings_router.update_certificate_diagnostics_settings(
        request=CertificateDiagnosticsSettingsUpdateRequest(
            auto_check_interval_minutes=90,
            repeat_alert_threshold=4,
            repeat_alert_window_minutes=360,
            repeat_alert_cooldown_minutes=720,
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1")),
    )

    assert StubSettingsRepository.store["certificate_preflight_auto_check_interval_minutes"] == "90"
    assert StubSettingsRepository.store["certificate_preflight_repeat_alert_threshold"] == "4"
    assert StubSettingsRepository.store["certificate_preflight_repeat_alert_window_minutes"] == "360"
    assert StubSettingsRepository.store["certificate_preflight_repeat_alert_cooldown_minutes"] == "720"
    assert response.auto_check_interval_minutes == 90
    assert response.repeat_alert_threshold == 4
    assert recorded[0]["detail"]["event"] == "settings_update_certificate_diagnostics"
    assert recorded[0]["detail"]["changed_keys"] == [
        "auto_check_interval_minutes",
        "repeat_alert_cooldown_minutes",
        "repeat_alert_threshold",
        "repeat_alert_window_minutes",
    ]
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.11"

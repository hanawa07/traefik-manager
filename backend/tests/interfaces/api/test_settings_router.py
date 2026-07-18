import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from types import SimpleNamespace

from app.interfaces.api.v1.routers import settings as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsUpdateRequest,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsUpdateRequest,
)
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
@pytest.mark.parametrize(
    (
        "role",
        "summary",
        "history",
        "history_days",
        "include_logs",
        "include_history",
        "expected_history_days",
    ),
    [
        ("admin", False, False, 30, True, True, None),
        ("admin", True, False, 30, False, False, None),
        ("admin", True, True, 30, False, True, 30),
        ("viewer", True, True, 30, False, False, None),
    ],
)
async def test_get_smoke_rotation_status_skips_admin_details_for_summary(
    monkeypatch,
    role: str,
    summary: bool,
    history: bool,
    history_days: int,
    include_logs: bool,
    include_history: bool,
    expected_history_days: int | None,
):
    calls = []

    async def fake_status_response(_db, **kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(settings_router, "_get_smoke_rotation_status_response", fake_status_response)

    await settings_router.get_smoke_rotation_status(
        db=object(),
        current_user={"role": role},
        refresh_monitoring_history=True,
        summary=summary,
        history=history,
        history_days=history_days,
    )

    assert calls == [
        {
            "include_recent_logs": include_logs,
            "include_monitoring_history": include_history,
            "monitoring_history_days": expected_history_days,
            "force_refresh_monitoring_history": role == "admin" and not summary,
        }
    ]


@pytest.mark.asyncio
async def test_get_smoke_rotation_status_rejects_unsupported_history_days():
    with pytest.raises(HTTPException, match="history_days는 7 또는 30이어야 합니다"):
        await settings_router.get_smoke_rotation_status(
            db=object(),
            current_user={"role": "admin"},
            history=True,
            history_days=8,
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

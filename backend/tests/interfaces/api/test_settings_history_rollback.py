from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_history_router_fakes import (
    StubSingleAuditLogDb,
    make_request,
    make_settings_history_log,
)
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_rollback_settings_change_restores_time_display(monkeypatch):
    StubSettingsRepository.store = {"display_timezone": "America/New_York"}
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router, "get_client_ip", lambda _request: "203.0.113.15")
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(settings_router.audit_service, "record", fake_record, raising=False)

    response = await settings_router.rollback_settings_change(
        audit_log_id="log-1",
        http_request=make_request(),
        db=StubSingleAuditLogDb(
            make_settings_history_log(
                log_id="log-1",
                event="settings_update_time_display",
                action="update",
                resource_id="settings_update_time_display",
                resource_name="시간 표시 설정",
                detail={
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

    async def noop_record(**_kwargs):
        return None

    monkeypatch.setattr(settings_router.audit_service, "record", noop_record, raising=False)

    response = await settings_router.rollback_settings_change(
        audit_log_id="log-2",
        http_request=make_request(),
        db=StubSingleAuditLogDb(
            make_settings_history_log(
                log_id="log-2",
                event="settings_update_upstream_security",
                action="update",
                resource_id="settings_update_upstream_security",
                resource_name="업스트림 보안 설정",
                detail={
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
async def test_rollback_settings_change_rejects_unsupported_event():
    with pytest.raises(HTTPException):
        await settings_router.rollback_settings_change(
            audit_log_id="log-3",
            http_request=make_request(),
            db=StubSingleAuditLogDb(
                make_settings_history_log(
                    log_id="log-3",
                    event="settings_update_security_alert",
                    action="update",
                    resource_id="settings_update_security_alert",
                    resource_name="보안 알림 설정",
                    detail={
                        "rollback_supported": False,
                        "before": {"enabled": False},
                        "after": {"enabled": True},
                    },
                    created_at=datetime.now(timezone.utc),
                )
            ),
            _={"role": "admin", "username": "admin"},
        )

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_router_fakes import (
    StubAuditHistoryDb,
    StubSettingsRepository,
    make_audit_log,
)


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
            resource_id="settings_test_cloudflare_drift",
            resource_name="Cloudflare DNS 드리프트 진단",
            detail={"event": "settings_test_cloudflare_drift", "success": False, "message": "드리프트 감지"},
            created_at=now,
        ),
        SimpleNamespace(
            id="3",
            actor="admin",
            action="test",
            resource_type="settings",
            resource_id="settings_test_cloudflare_reconcile",
            resource_name="Cloudflare DNS 재동기화",
            detail={"event": "settings_test_cloudflare_reconcile", "success": True, "message": "재동기화 완료"},
            created_at=now,
        ),
        SimpleNamespace(
            id="4",
            actor="admin",
            action="test",
            resource_type="settings",
            resource_id="settings_test_security_alert",
            resource_name="보안 알림 테스트",
            detail={"event": "settings_test_security_alert", "success": False, "message": "실패", "provider": "slack"},
            created_at=now,
        ),
        SimpleNamespace(
            id="5",
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
            id="6",
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
    assert response.cloudflare_drift.last_event == "settings_test_cloudflare_drift"
    assert response.cloudflare_drift.last_success is False
    assert response.cloudflare_drift.last_message == "드리프트 감지"
    assert response.cloudflare_reconcile.last_event == "settings_test_cloudflare_reconcile"
    assert response.cloudflare_reconcile.last_success is True
    assert response.cloudflare_reconcile.last_message == "재동기화 완료"
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

    assert response.cloudflare_drift.last_event is None
    assert response.cloudflare_reconcile.last_event is None
    assert response.security_alert_delivery.last_event == "security_alert_delivery_failure"
    assert response.security_alert_delivery.last_failure_at is not None
    assert response.security_alert_delivery.last_failure_at.tzinfo is not None
    assert response.security_alert_delivery.recent_failure_count == 1

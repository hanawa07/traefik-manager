from datetime import datetime, timedelta, timezone

import pytest

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import StubAuditDb, make_log


@pytest.mark.asyncio
async def test_list_audit_logs_filters_by_event_and_applies_pagination():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(event="login_failure", resource_name="alice", created_at=now - timedelta(minutes=1)),
            make_log(event="login_locked", resource_name="alice", created_at=now - timedelta(minutes=2)),
            make_log(event="login_locked", resource_name="bob", created_at=now - timedelta(minutes=3)),
            make_log(event="service_updated", resource_type="service", resource_name="svc", created_at=now - timedelta(minutes=4)),
        ]
    )

    result = await audit_router.list_audit_logs(
        limit=1,
        offset=1,
        resource_type=None,
        action=None,
        event="login_locked",
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].event == "login_locked"
    assert result[0].resource_name == "bob"


@pytest.mark.asyncio
async def test_list_audit_logs_filters_by_resource_type_and_action():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                action="update",
                resource_type="settings",
                resource_name="시간 표시 설정",
                event="settings_update_time_display",
                created_at=now - timedelta(minutes=1),
            ),
            make_log(
                action="test",
                resource_type="settings",
                resource_name="Cloudflare 연결 테스트",
                event="settings_test_cloudflare",
                created_at=now - timedelta(minutes=2),
            ),
            make_log(
                action="update",
                resource_type="service",
                resource_name="svc",
                event="service_updated",
                created_at=now - timedelta(minutes=3),
            ),
        ]
    )

    result = await audit_router.list_audit_logs(
        limit=10,
        offset=0,
        resource_type="settings",
        action="update",
        event=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].resource_type == "settings"
    assert result[0].action == "update"
    assert result[0].event == "settings_update_time_display"


@pytest.mark.asyncio
async def test_list_audit_logs_filters_by_delivery_status_and_provider():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="보안 알림 전송 결과",
                event="security_alert_delivery_success",
                created_at=now - timedelta(minutes=1),
                detail_extra={"success": True, "provider": "slack"},
            ),
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="보안 알림 전송 결과",
                event="security_alert_delivery_failure",
                created_at=now - timedelta(minutes=2),
                detail_extra={"success": False, "provider": "pagerduty"},
            ),
            make_log(
                action="alert",
                resource_type="settings",
                resource_name="운영 변경 알림 전송 결과",
                event="change_alert_delivery_failure",
                created_at=now - timedelta(minutes=3),
                detail_extra={"success": False, "provider": "email"},
            ),
        ]
    )

    result = await audit_router.list_audit_logs(
        limit=10,
        offset=0,
        resource_type=None,
        action="alert",
        event=None,
        security_only=False,
        provider="pagerduty",
        delivery_success=False,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].event == "security_alert_delivery_failure"
    assert result[0].detail["provider"] == "pagerduty"

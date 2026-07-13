from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Response

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

    response = Response()
    result = await audit_router.list_audit_logs(
        response=response,
        limit=1,
        offset=1,
        resource_type=None,
        action=None,
        event="login_locked",
        manager_status=None,
        manager_source=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert response.headers["x-total-count"] == "2"
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
        response=Response(),
        limit=10,
        offset=0,
        resource_type="settings",
        action="update",
        event=None,
        manager_status=None,
        manager_source=None,
        search=None,
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
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action="alert",
        event=None,
        manager_status=None,
        manager_source=None,
        search=None,
        security_only=False,
        provider="pagerduty",
        delivery_success=False,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].event == "security_alert_delivery_failure"
    assert result[0].detail["provider"] == "pagerduty"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_status", "expected_events"),
    [
        ("unhealthy", {"manager_docker_unhealthy", "manager_watchdog_stale"}),
        ("recovered", {"manager_docker_recovered", "manager_watchdog_recovered"}),
    ],
)
async def test_list_audit_logs_filters_manager_status(manager_status, expected_events):
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(event=event, resource_type="manager_component", created_at=now)
            for event in expected_events
        ]
        + [make_log(event="service_updated", resource_type="service", created_at=now)]
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=manager_status,
        manager_source=None,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("manager_source", "expected_events"),
    [
        ("docker", {"manager_docker_unhealthy", "manager_docker_recovered"}),
        ("watchdog", {"manager_watchdog_stale", "manager_watchdog_recovered"}),
    ],
)
async def test_list_audit_logs_filters_manager_source(manager_source, expected_events):
    now = datetime.now(timezone.utc)
    all_events = {
        "manager_docker_unhealthy",
        "manager_docker_recovered",
        "manager_watchdog_stale",
        "manager_watchdog_recovered",
    }
    db = StubAuditDb(
        [
            make_log(event=event, resource_type="manager_component", created_at=now)
            for event in all_events
        ]
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=manager_source,
        search=None,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert {item.event for item in result} == expected_events


@pytest.mark.asyncio
@pytest.mark.parametrize("search", ["LIZSTUDIO", "english", "3011"])
async def test_list_audit_logs_searches_actor_and_target(search):
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                actor="lizstudio",
                resource_id="service-3011",
                resource_name="English Service",
                created_at=now,
            ),
            make_log(actor="viewer", resource_name="다른 서비스", created_at=now),
        ]
    )

    result = await audit_router.list_audit_logs(
        response=Response(),
        limit=10,
        offset=0,
        resource_type=None,
        action=None,
        event=None,
        manager_status=None,
        manager_source=None,
        search=search,
        security_only=False,
        provider=None,
        delivery_success=None,
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].resource_name == "English Service"

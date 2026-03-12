from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.interfaces.api.v1.routers import audit as audit_router


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


class StubAuditDb:
    def __init__(self, logs):
        self._logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self._logs)


def make_log(
    *,
    actor: str = "admin",
    action: str = "update",
    resource_type: str = "user",
    resource_name: str = "admin",
    event: str | None = None,
    client_ip: str | None = None,
    created_at: datetime,
):
    detail = None
    if event is not None or client_ip is not None:
        detail = {}
        if event is not None:
            detail["event"] = event
        if client_ip is not None:
            detail["client_ip"] = client_ip
    return SimpleNamespace(
        id=uuid4(),
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=str(uuid4()),
        resource_name=resource_name,
        detail=detail,
        created_at=created_at,
    )


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
        db=db,
        _={"username": "admin"},
    )

    assert len(result) == 1
    assert result[0].resource_type == "settings"
    assert result[0].action == "update"
    assert result[0].event == "settings_update_time_display"


@pytest.mark.asyncio
async def test_get_security_summary_counts_recent_events():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(event="login_failure", resource_name="alice", client_ip="1.1.1.1", created_at=now - timedelta(minutes=5)),
            make_log(event="login_locked", resource_name="alice", client_ip="1.1.1.1", created_at=now - timedelta(minutes=4)),
            make_log(event="login_suspicious", resource_name="1.1.1.1", client_ip="1.1.1.1", created_at=now - timedelta(minutes=3)),
            make_log(event="login_blocked_ip", resource_name="1.1.1.1", client_ip="1.1.1.1", created_at=now - timedelta(minutes=2)),
            make_log(event="service_updated", resource_type="service", resource_name="svc", created_at=now - timedelta(minutes=1)),
            make_log(event="login_locked", resource_name="old-user", client_ip="2.2.2.2", created_at=now - timedelta(days=2)),
        ]
    )

    result = await audit_router.get_security_summary(
        window_minutes=60,
        recent_limit=2,
        db=db,
        _={"username": "admin"},
    )

    assert result.window_minutes == 60
    assert result.failed_login_count == 1
    assert result.locked_login_count == 1
    assert result.suspicious_ip_count == 1
    assert result.blocked_ip_count == 1
    assert [item.event for item in result.recent_events] == ["login_blocked_ip", "login_suspicious"]
    assert result.recent_events[0].client_ip == "1.1.1.1"


@pytest.mark.asyncio
async def test_get_certificate_summary_counts_recent_events():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                event="certificate_warning",
                resource_type="certificate",
                resource_name="example.com",
                created_at=now - timedelta(minutes=5),
            ),
            make_log(
                event="certificate_error",
                resource_type="certificate",
                resource_name="expired.example.com",
                created_at=now - timedelta(minutes=4),
            ),
            make_log(
                event="certificate_warning",
                resource_type="certificate",
                resource_name="old.example.com",
                created_at=now - timedelta(days=2),
            ),
            make_log(
                event="service_updated",
                resource_type="service",
                resource_name="svc",
                created_at=now - timedelta(minutes=3),
            ),
        ]
    )

    result = await audit_router.get_certificate_summary(
        window_minutes=60,
        recent_limit=2,
        db=db,
        _={"username": "admin"},
    )

    assert result.window_minutes == 60
    assert result.warning_count == 1
    assert result.error_count == 1
    assert [item.event for item in result.recent_events] == ["certificate_error", "certificate_warning"]
    assert result.recent_events[0].resource_name == "expired.example.com"

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.application.auth import login_anomaly_service

DEFAULT_CLIENT_IP = "1.2.3.4"
DEFAULT_NOW = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)


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


class StubDbSession:
    def __init__(self, logs):
        self.logs = logs

    async def execute(self, _query):
        return StubExecuteResult(self.logs)


def make_log(
    *,
    created_at: datetime,
    event: str,
    client_ip: str,
    resource_name: str,
    extra_detail: dict | None = None,
):
    return SimpleNamespace(
        created_at=created_at,
        detail={"event": event, "client_ip": client_ip, **(extra_detail or {})},
        resource_name=resource_name,
    )


def make_login_log(
    *,
    minutes_ago: int,
    event: str,
    resource_name: str,
    now: datetime = DEFAULT_NOW,
    client_ip: str = DEFAULT_CLIENT_IP,
    extra_detail: dict | None = None,
    naive: bool = False,
):
    created_at = now - timedelta(minutes=minutes_ago)
    if naive:
        created_at = created_at.replace(tzinfo=None)
    return make_log(
        created_at=created_at,
        event=event,
        client_ip=client_ip,
        resource_name=resource_name,
        extra_detail=extra_detail,
    )


def make_multi_username_failure_logs(
    *,
    now: datetime = DEFAULT_NOW,
    client_ip: str = DEFAULT_CLIENT_IP,
    naive: bool = False,
):
    return [
        make_login_log(
            now=now,
            minutes_ago=2,
            event="login_failure",
            client_ip=client_ip,
            resource_name="alice",
            naive=naive,
        ),
        make_login_log(
            now=now,
            minutes_ago=3,
            event="login_failure",
            client_ip=client_ip,
            resource_name="bob",
            naive=naive,
        ),
        make_login_log(
            now=now,
            minutes_ago=4,
            event="login_failure",
            client_ip=client_ip,
            resource_name="charlie",
            naive=naive,
        ),
        make_login_log(
            now=now,
            minutes_ago=5,
            event="login_locked",
            client_ip=client_ip,
            resource_name="alice",
            naive=naive,
        ),
        make_login_log(
            now=now,
            minutes_ago=6,
            event="login_failure",
            client_ip=client_ip,
            resource_name="dana",
            naive=naive,
        ),
    ]


def patch_audit_records(monkeypatch):
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)
    return recorded

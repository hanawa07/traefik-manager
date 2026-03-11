from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.application.auth import login_anomaly_service


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


@pytest.mark.asyncio
async def test_records_suspicious_event_for_same_ip_across_multiple_usernames(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=3), event="login_failure", client_ip="1.2.3.4", resource_name="bob"),
        make_log(created_at=now - timedelta(minutes=4), event="login_failure", client_ip="1.2.3.4", resource_name="charlie"),
        make_log(created_at=now - timedelta(minutes=5), event="login_locked", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=6), event="login_failure", client_ip="1.2.3.4", resource_name="dana"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_suspicious"
    assert recorded[0]["detail"]["client_ip"] == "1.2.3.4"
    assert recorded[0]["detail"]["unique_usernames"] == 4


@pytest.mark.asyncio
async def test_does_not_record_suspicious_event_for_single_username(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=3), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=4), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=5), event="login_locked", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=6), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_does_not_record_duplicate_suspicious_event_within_window(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_failure", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=3), event="login_failure", client_ip="1.2.3.4", resource_name="bob"),
        make_log(created_at=now - timedelta(minutes=4), event="login_failure", client_ip="1.2.3.4", resource_name="charlie"),
        make_log(created_at=now - timedelta(minutes=5), event="login_locked", client_ip="1.2.3.4", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=6), event="login_failure", client_ip="1.2.3.4", resource_name="dana"),
        make_log(created_at=now - timedelta(minutes=1), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_records_block_event_once(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        block_window=timedelta(minutes=30),
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_blocked_ip"
    assert recorded[0]["resource_name"] == "1.2.3.4"
    assert recorded[0]["detail"]["block_minutes"] == 30
    assert recorded[0]["detail"]["repeat_count"] == 1
    assert "blocked_until" in recorded[0]["detail"]


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_skips_duplicate_block_event(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=3), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
        make_log(
            created_at=now - timedelta(minutes=1),
            event="login_blocked_ip",
            client_ip="1.2.3.4",
            resource_name="1.2.3.4",
            extra_detail={"blocked_until": (now + timedelta(minutes=29)).isoformat(), "block_minutes": 30, "repeat_count": 1},
        ),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        block_window=timedelta(minutes=30),
    )

    assert result is True
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_escalates_repeat_offender(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    previous_block_at = now - timedelta(hours=2)
    previous_block_until = previous_block_at + timedelta(minutes=30)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
        make_log(
            created_at=previous_block_at,
            event="login_blocked_ip",
            client_ip="1.2.3.4",
            resource_name="1.2.3.4",
            extra_detail={
                "blocked_until": previous_block_until.isoformat(),
                "block_minutes": 30,
                "repeat_count": 1,
            },
        ),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        block_window=timedelta(minutes=30),
        escalation_enabled=True,
        escalation_window=timedelta(hours=24),
        escalation_multiplier=2,
        max_block_window=timedelta(hours=24),
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_blocked_ip"
    assert recorded[0]["detail"]["block_minutes"] == 60
    assert recorded[0]["detail"]["repeat_count"] == 2
    assert recorded[0]["detail"]["escalated"] is True


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_ignores_old_suspicious_event(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=31), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        block_window=timedelta(minutes=30),
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_record_suspicious_event_skips_trusted_client_ip(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_failure", client_ip="10.20.30.40", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=3), event="login_failure", client_ip="10.20.30.40", resource_name="bob"),
        make_log(created_at=now - timedelta(minutes=4), event="login_failure", client_ip="10.20.30.40", resource_name="charlie"),
        make_log(created_at=now - timedelta(minutes=5), event="login_locked", client_ip="10.20.30.40", resource_name="alice"),
        make_log(created_at=now - timedelta(minutes=6), event="login_failure", client_ip="10.20.30.40", resource_name="dana"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip="10.20.30.40",
        now=now,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
        trusted_networks=["10.0.0.0/8"],
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_skips_trusted_client_ip(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_suspicious", client_ip="10.20.30.40", resource_name="10.20.30.40"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="10.20.30.40",
        now=now,
        block_window=timedelta(minutes=30),
        trusted_networks=["10.0.0.0/8"],
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_respects_disabled_policy(monkeypatch):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    logs = [
        make_log(created_at=now - timedelta(minutes=2), event="login_suspicious", client_ip="1.2.3.4", resource_name="1.2.3.4"),
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(login_anomaly_service.audit_service, "record", fake_record, raising=False)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip="1.2.3.4",
        now=now,
        block_window=timedelta(minutes=30),
        block_enabled=False,
    )

    assert result is False
    assert recorded == []

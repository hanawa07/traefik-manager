from datetime import timedelta

import pytest

from app.application.auth import login_anomaly_service
from tests.application.auth.login_anomaly_fakes import (
    DEFAULT_CLIENT_IP,
    DEFAULT_NOW,
    StubDbSession,
    make_login_log,
    patch_audit_records,
)


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_records_block_event_once(monkeypatch):
    logs = [
        make_login_log(
            minutes_ago=2,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        block_window=timedelta(minutes=30),
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_blocked_ip"
    assert recorded[0]["resource_name"] == DEFAULT_CLIENT_IP
    assert recorded[0]["detail"]["block_minutes"] == 30
    assert recorded[0]["detail"]["repeat_count"] == 1
    assert "blocked_until" in recorded[0]["detail"]


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_skips_duplicate_block_event(monkeypatch):
    logs = [
        make_login_log(
            minutes_ago=3,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
        make_login_log(
            minutes_ago=1,
            event="login_blocked_ip",
            resource_name=DEFAULT_CLIENT_IP,
            extra_detail={
                "blocked_until": (DEFAULT_NOW + timedelta(minutes=29)).isoformat(),
                "block_minutes": 30,
                "repeat_count": 1,
            },
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        block_window=timedelta(minutes=30),
    )

    assert result is True
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_escalates_repeat_offender(monkeypatch):
    previous_block_at = DEFAULT_NOW - timedelta(hours=2)
    previous_block_until = previous_block_at + timedelta(minutes=30)
    logs = [
        make_login_log(
            minutes_ago=2,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
        make_login_log(
            minutes_ago=120,
            event="login_blocked_ip",
            resource_name=DEFAULT_CLIENT_IP,
            extra_detail={
                "blocked_until": previous_block_until.isoformat(),
                "block_minutes": 30,
                "repeat_count": 1,
            },
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
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
    logs = [
        make_login_log(
            minutes_ago=31,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        block_window=timedelta(minutes=30),
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_respects_disabled_policy(monkeypatch):
    logs = [
        make_login_log(
            minutes_ago=2,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        block_window=timedelta(minutes=30),
        block_enabled=False,
    )

    assert result is False
    assert recorded == []

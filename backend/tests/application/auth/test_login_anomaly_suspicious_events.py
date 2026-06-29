from datetime import timedelta

import pytest

from app.application.auth import login_anomaly_service
from tests.application.auth.login_anomaly_fakes import (
    DEFAULT_CLIENT_IP,
    DEFAULT_NOW,
    StubDbSession,
    make_login_log,
    make_multi_username_failure_logs,
    patch_audit_records,
)


@pytest.mark.asyncio
async def test_records_suspicious_event_for_same_ip_across_multiple_usernames(monkeypatch):
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(make_multi_username_failure_logs()),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_suspicious"
    assert recorded[0]["detail"]["client_ip"] == DEFAULT_CLIENT_IP
    assert recorded[0]["detail"]["unique_usernames"] == 4


@pytest.mark.asyncio
async def test_does_not_record_suspicious_event_for_single_username(monkeypatch):
    logs = [
        make_login_log(minutes_ago=2, event="login_failure", resource_name="alice"),
        make_login_log(minutes_ago=3, event="login_failure", resource_name="alice"),
        make_login_log(minutes_ago=4, event="login_failure", resource_name="alice"),
        make_login_log(minutes_ago=5, event="login_locked", resource_name="alice"),
        make_login_log(minutes_ago=6, event="login_failure", resource_name="alice"),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_does_not_record_duplicate_suspicious_event_within_window(monkeypatch):
    logs = [
        *make_multi_username_failure_logs(),
        make_login_log(
            minutes_ago=1,
            event="login_suspicious",
            resource_name=DEFAULT_CLIENT_IP,
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(logs),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_records_suspicious_event_with_naive_created_at(monkeypatch):
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(make_multi_username_failure_logs(naive=True)),
        client_ip=DEFAULT_CLIENT_IP,
        now=DEFAULT_NOW,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
    )

    assert result is True
    assert recorded[0]["detail"]["event"] == "login_suspicious"
    assert recorded[0]["detail"]["client_ip"] == DEFAULT_CLIENT_IP

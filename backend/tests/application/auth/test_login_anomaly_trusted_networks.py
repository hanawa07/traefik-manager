from datetime import timedelta

import pytest

from app.application.auth import login_anomaly_service
from tests.application.auth.login_anomaly_fakes import (
    DEFAULT_NOW,
    StubDbSession,
    make_login_log,
    make_multi_username_failure_logs,
    patch_audit_records,
)

TRUSTED_CLIENT_IP = "10.20.30.40"


@pytest.mark.asyncio
async def test_record_suspicious_event_skips_trusted_client_ip(monkeypatch):
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.record_suspicious_login_activity_if_needed(
        db=StubDbSession(make_multi_username_failure_logs(client_ip=TRUSTED_CLIENT_IP)),
        client_ip=TRUSTED_CLIENT_IP,
        now=DEFAULT_NOW,
        window=timedelta(minutes=15),
        min_failures=5,
        min_unique_usernames=3,
        trusted_networks=["10.0.0.0/8"],
    )

    assert result is False
    assert recorded == []


@pytest.mark.asyncio
async def test_enforce_suspicious_ip_block_skips_trusted_client_ip(monkeypatch):
    logs = [
        make_login_log(
            minutes_ago=2,
            event="login_suspicious",
            client_ip=TRUSTED_CLIENT_IP,
            resource_name=TRUSTED_CLIENT_IP,
        ),
    ]
    recorded = patch_audit_records(monkeypatch)

    result = await login_anomaly_service.enforce_suspicious_ip_block_if_needed(
        db=StubDbSession(logs),
        client_ip=TRUSTED_CLIENT_IP,
        now=DEFAULT_NOW,
        block_window=timedelta(minutes=30),
        trusted_networks=["10.0.0.0/8"],
    )

    assert result is False
    assert recorded == []

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.certificates import certificate_alert_monitor


class StubSettingsRepository:
    store: dict[str, str] = {}

    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str | None) -> None:
        if value is None:
            self.store.pop(key, None)
        else:
            self.store[key] = value


class StubSession:
    def __init__(self):
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


@asynccontextmanager
async def make_session():
    yield StubSession()


class StubTraefikClient:
    certificates = []

    async def list_certificates(self):
        return StubTraefikClient.certificates


@pytest.mark.asyncio
async def test_check_certificate_alerts_once_records_warning_and_persists_state(monkeypatch):
    StubSettingsRepository.store = {}
    StubTraefikClient.certificates = [
        {
            "domain": "example.com",
            "expires_at": datetime(2026, 3, 20, tzinfo=timezone.utc),
            "days_remaining": 8,
            "status": "warning",
            "status_message": "8일 이내 만료 예정",
            "router_names": ["example-router"],
        }
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(certificate_alert_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(certificate_alert_monitor, "TraefikApiClient", StubTraefikClient)
    monkeypatch.setattr(certificate_alert_monitor.audit_service, "record", fake_record, raising=False)

    await certificate_alert_monitor.check_certificate_alerts_once(
        session_factory=make_session,
        now=datetime(2026, 3, 12, tzinfo=timezone.utc),
    )

    assert recorded[0]["resource_type"] == "certificate"
    assert recorded[0]["resource_id"] == "example.com"
    assert recorded[0]["detail"]["event"] == "certificate_warning"
    assert recorded[0]["detail"]["days_remaining"] == 8
    stored_state = json.loads(StubSettingsRepository.store[certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY])
    assert stored_state["example.com"]["status"] == "warning"


@pytest.mark.asyncio
async def test_check_certificate_alerts_once_deduplicates_same_warning_status(monkeypatch):
    StubSettingsRepository.store = {
        certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY: json.dumps(
            {
                "example.com": {
                    "status": "warning",
                    "days_remaining": 8,
                    "expires_at": "2026-03-20T00:00:00+00:00",
                }
            }
        )
    }
    StubTraefikClient.certificates = [
        {
            "domain": "example.com",
            "expires_at": datetime(2026, 3, 20, tzinfo=timezone.utc),
            "days_remaining": 8,
            "status": "warning",
            "status_message": "8일 이내 만료 예정",
            "router_names": ["example-router"],
        }
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(certificate_alert_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(certificate_alert_monitor, "TraefikApiClient", StubTraefikClient)
    monkeypatch.setattr(certificate_alert_monitor.audit_service, "record", fake_record, raising=False)

    await certificate_alert_monitor.check_certificate_alerts_once(
        session_factory=make_session,
        now=datetime(2026, 3, 12, tzinfo=timezone.utc),
    )

    assert recorded == []


@pytest.mark.asyncio
async def test_check_certificate_alerts_once_records_error_when_warning_escalates(monkeypatch):
    StubSettingsRepository.store = {
        certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY: json.dumps(
            {
                "example.com": {
                    "status": "warning",
                    "days_remaining": 1,
                    "expires_at": "2026-03-13T00:00:00+00:00",
                }
            }
        )
    }
    StubTraefikClient.certificates = [
        {
            "domain": "example.com",
            "expires_at": datetime(2026, 3, 10, tzinfo=timezone.utc),
            "days_remaining": -2,
            "status": "error",
            "status_message": "인증서가 만료되었습니다",
            "router_names": ["example-router"],
        }
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(certificate_alert_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(certificate_alert_monitor, "TraefikApiClient", StubTraefikClient)
    monkeypatch.setattr(certificate_alert_monitor.audit_service, "record", fake_record, raising=False)

    await certificate_alert_monitor.check_certificate_alerts_once(
        session_factory=make_session,
        now=datetime(2026, 3, 12, tzinfo=timezone.utc),
    )

    assert recorded[0]["detail"]["event"] == "certificate_error"
    assert recorded[0]["detail"]["previous_status"] == "warning"

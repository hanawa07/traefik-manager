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

    result = await certificate_alert_monitor.check_certificate_alerts_once(
        session_factory=make_session,
        now=datetime(2026, 3, 12, tzinfo=timezone.utc),
    )

    assert result["total_count"] == 1
    assert result["warning_count"] == 1
    assert result["error_count"] == 0
    assert result["recorded_event_count"] == 1
    assert recorded[0]["resource_type"] == "certificate"
    assert recorded[0]["resource_id"] == "example.com"
    assert recorded[0]["detail"]["event"] == "certificate_warning"
    assert recorded[0]["detail"]["days_remaining"] == 8
    stored_state = json.loads(StubSettingsRepository.store[certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY])
    assert stored_state["example.com"]["status"] == "warning"
    assert stored_state["example.com"]["status_started_at"] == "2026-03-12T00:00:00+00:00"


@pytest.fixture
def renewal_monitor(monkeypatch):
    StubSettingsRepository.store = {}
    StubTraefikClient.certificates = []
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(certificate_alert_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(certificate_alert_monitor, "TraefikApiClient", StubTraefikClient)
    monkeypatch.setattr(certificate_alert_monitor.audit_service, "record", fake_record)

    async def check(days, status="warning", resolvers=None):
        StubTraefikClient.certificates = [{
            "domain": "renewal.example.com",
            "status": status,
            "days_remaining": days,
            "cert_resolvers": ["letsencrypt"] if resolvers is None else resolvers,
            "expires_at": datetime(2026, 12, 2, tzinfo=timezone.utc),
        }]
        return await certificate_alert_monitor.check_certificate_alerts_once(
            session_factory=make_session,
            now=datetime(2026, 11, 2, tzinfo=timezone.utc),
        )

    return check, recorded


@pytest.mark.asyncio
@pytest.mark.parametrize("days", [30, 8, 7, 1, 0, None])
async def test_auto_renewal_keeps_warning_history_without_expiry_countdown_push(renewal_monitor, days):
    check, recorded = renewal_monitor
    result = await check(days)
    assert result["warning_count"] == 1
    assert result["recorded_event_count"] == 1
    assert recorded[0]["detail"]["event"] == "certificate_warning"
    assert recorded[0]["notify"] is False


@pytest.mark.asyncio
async def test_auto_renewal_stays_silent_until_expired_and_then_reports_recovery(renewal_monitor):
    check, recorded = renewal_monitor
    for days in [30, 29, 8, 7, 7, 6, 1, 0]:
        await check(days)
    await check(-1, "error")
    await check(-2, "error")
    await check(90, "active")
    assert [(row["detail"]["event"], row["notify"]) for row in recorded] == [
        ("certificate_warning", False),
        ("certificate_error", True),
        ("certificate_recovered", True),
    ]
    assert recorded[1]["detail"]["days_remaining"] == -1


@pytest.mark.asyncio
async def test_auto_renewal_routine_warning_recovery_stays_silent(renewal_monitor):
    check, recorded = renewal_monitor
    await check(30)
    await check(90, "active")
    assert [(row["detail"]["event"], row["notify"]) for row in recorded] == [
        ("certificate_warning", False),
        ("certificate_recovered", False),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("days,status,resolvers", [(30, "warning", []), (-1, "error", ["letsencrypt"])])
async def test_manual_certificates_and_expired_certificates_still_push(renewal_monitor, days, status, resolvers):
    check, recorded = renewal_monitor
    await check(days, status, resolvers)
    assert recorded[0]["notify"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("days,status", [(7, "warning"), (90, "active")])
async def test_legacy_routine_warning_state_stays_silent(renewal_monitor, days, status):
    check, recorded = renewal_monitor
    StubSettingsRepository.store[certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY] = json.dumps({
        "renewal.example.com": {"status": "warning", "days_remaining": 30},
    })
    await check(days, status)
    if status == "warning":
        assert recorded == []
    else:
        assert len(recorded) == 1
        assert recorded[0]["notify"] is False


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
async def test_check_certificate_alerts_once_returns_summary_without_new_alert(monkeypatch):
    StubSettingsRepository.store = {}
    StubTraefikClient.certificates = [
        {
            "domain": "active.example.com",
            "expires_at": datetime(2026, 6, 1, tzinfo=timezone.utc),
            "days_remaining": 81,
            "status": "active",
            "status_message": "정상",
            "router_names": ["active-router"],
        }
    ]
    recorded = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(certificate_alert_monitor, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(certificate_alert_monitor, "TraefikApiClient", StubTraefikClient)
    monkeypatch.setattr(certificate_alert_monitor.audit_service, "record", fake_record, raising=False)

    result = await certificate_alert_monitor.check_certificate_alerts_once(
        session_factory=make_session,
        now=datetime(2026, 3, 12, tzinfo=timezone.utc),
    )

    assert result["total_count"] == 1
    assert result["warning_count"] == 0
    assert result["error_count"] == 0
    assert result["recorded_event_count"] == 0
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


@pytest.mark.asyncio
async def test_check_certificate_alerts_once_records_recovery_when_alerted_certificate_becomes_active(monkeypatch):
    StubSettingsRepository.store = {
        certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY: json.dumps(
            {
                "example.com": {
                    "status": "error",
                    "days_remaining": -1,
                    "expires_at": "2026-03-11T00:00:00+00:00",
                    "status_started_at": "2026-03-11T00:00:00+00:00",
                }
            }
        )
    }
    StubTraefikClient.certificates = [
        {
            "domain": "example.com",
            "expires_at": datetime(2026, 6, 1, tzinfo=timezone.utc),
            "days_remaining": 81,
            "status": "active",
            "status_message": "정상",
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

    assert recorded[0]["detail"]["event"] == "certificate_recovered"
    assert recorded[0]["detail"]["previous_status"] == "error"
    stored_state = json.loads(StubSettingsRepository.store[certificate_alert_monitor.CERTIFICATE_ALERT_STATE_KEY])
    assert stored_state["example.com"]["status"] == "active"
    assert stored_state["example.com"]["status_started_at"] == "2026-03-12T00:00:00+00:00"

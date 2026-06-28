import pytest

from app.application.certificate import preflight_service
from app.core.certificate_diagnostics import CertificateDiagnosticsSettings
from tests.application.certificate.preflight_service_fakes import (
    StubAuditDb,
    capture_audit_records,
    make_preflight_log,
    make_preflight_result,
    utc_dt,
)


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_records_repeated_failure_when_threshold_hit(monkeypatch):
    captured_records = capture_audit_records(monkeypatch)
    repeated_logs = [
        make_preflight_log(checked_at=utc_dt(11, 55)),
        make_preflight_log(checked_at=utc_dt(11, 50)),
    ]

    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(repeated_logs),
        actor="admin",
        domain="example.com",
        result=make_preflight_result(),
        client_ip="127.0.0.1",
    )

    assert result["repeated_failure_streak"] == 3
    assert result["repeated_failure_active"] is True
    assert result["repeated_failure_emitted"] is True
    assert [record["detail"]["event"] for record in captured_records] == [
        "certificate_preflight",
        "certificate_preflight_repeated_failure",
    ]
    assert captured_records[1]["action"] == "alert"
    assert captured_records[1]["detail"]["consecutive_count"] == 3
    assert captured_records[1]["detail"]["failure_keys"] == ["dns_public"]


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_suppresses_repeated_failure_within_cooldown(monkeypatch):
    captured_records = capture_audit_records(monkeypatch)
    previous_logs = [
        make_preflight_log(
            checked_at=utc_dt(11, 58),
            event="certificate_preflight_repeated_failure",
            failure_keys=["dns_public"],
        ),
        make_preflight_log(checked_at=utc_dt(11, 55)),
        make_preflight_log(checked_at=utc_dt(11, 50)),
    ]

    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 240)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result=make_preflight_result(),
        client_ip="127.0.0.1",
    )

    assert result["repeated_failure_streak"] == 3
    assert result["repeated_failure_active"] is True
    assert result["repeated_failure_emitted"] is False
    assert [record["detail"]["event"] for record in captured_records] == ["certificate_preflight"]


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_emits_repeated_failure_after_cooldown(monkeypatch):
    captured_records = capture_audit_records(monkeypatch)
    previous_logs = [
        make_preflight_log(
            checked_at=utc_dt(7),
            event="certificate_preflight_repeated_failure",
            failure_keys=["dns_public"],
        ),
        make_preflight_log(checked_at=utc_dt(11, 55)),
        make_preflight_log(checked_at=utc_dt(11, 50)),
    ]

    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 60)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result=make_preflight_result(),
        client_ip="127.0.0.1",
    )

    assert result["repeated_failure_streak"] == 3
    assert result["repeated_failure_active"] is True
    assert result["repeated_failure_emitted"] is True
    assert [record["detail"]["event"] for record in captured_records] == [
        "certificate_preflight",
        "certificate_preflight_repeated_failure",
    ]


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_uses_runtime_config_override(monkeypatch):
    captured_records = capture_audit_records(monkeypatch)
    previous_logs = [make_preflight_log(checked_at=utc_dt(11, 55))]

    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 5)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result=make_preflight_result(),
        client_ip="127.0.0.1",
        config=CertificateDiagnosticsSettings(
            auto_check_interval_minutes=60,
            repeat_alert_threshold=2,
            repeat_alert_window_minutes=240,
            repeat_alert_cooldown_minutes=240,
        ),
    )

    assert result["repeated_failure_streak"] == 2
    assert result["repeated_failure_active"] is True
    assert result["repeated_failure_emitted"] is True
    assert [record["detail"]["event"] for record in captured_records] == [
        "certificate_preflight",
        "certificate_preflight_repeated_failure",
    ]

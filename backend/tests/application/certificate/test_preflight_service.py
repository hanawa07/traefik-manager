from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.application.certificate import preflight_service
from app.core.certificate_diagnostics import CertificateDiagnosticsSettings


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


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_records_snapshot(monkeypatch):
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    previous_log = SimpleNamespace(
        detail={
            "event": "certificate_preflight",
            "checked_at": "2026-03-12T11:45:00+00:00",
            "overall_status": "error",
            "recommendation": "직전에는 DNS timeout이 있어 권한 DNS를 먼저 확인해야 했습니다.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
        created_at=datetime(2026, 3, 12, 11, 45, tzinfo=timezone.utc),
    )

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb([previous_log]),
        actor="admin",
        domain="example.com",
        result={
            "domain": "example.com",
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "ok",
                    "detail": "A 1개, AAAA 없음",
                }
            ],
        },
        client_ip="127.0.0.1",
    )

    assert result["previous_result"]["overall_status"] == "error"
    assert result["repeated_failure_streak"] == 0
    assert result["repeated_failure_active"] is False
    assert captured_records[0]["resource_type"] == "certificate"
    assert captured_records[0]["resource_name"] == "example.com"
    assert captured_records[0]["detail"]["event"] == "certificate_preflight"
    assert captured_records[0]["detail"]["client_ip"] == "127.0.0.1"
    assert captured_records[0]["detail"]["checked_at"] == "2026-03-12T12:00:00+00:00"


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_records_repeated_failure_when_threshold_hit(monkeypatch):
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    repeated_logs = [
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:55:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 55, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:50:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 50, tzinfo=timezone.utc),
        ),
    ]

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(repeated_logs),
        actor="admin",
        domain="example.com",
        result={
            "domain": "example.com",
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
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
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    previous_logs = [
        SimpleNamespace(
            detail={
                "event": "certificate_preflight_repeated_failure",
                "checked_at": "2026-03-12T11:58:00+00:00",
                "overall_status": "warning",
                "failure_keys": ["dns_public"],
            },
            created_at=datetime(2026, 3, 12, 11, 58, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:55:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 55, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:50:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 50, tzinfo=timezone.utc),
        ),
    ]

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 240)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result={
            "domain": "example.com",
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
        client_ip="127.0.0.1",
    )

    assert result["repeated_failure_streak"] == 3
    assert result["repeated_failure_active"] is True
    assert result["repeated_failure_emitted"] is False
    assert [record["detail"]["event"] for record in captured_records] == ["certificate_preflight"]


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_emits_repeated_failure_after_cooldown(monkeypatch):
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    previous_logs = [
        SimpleNamespace(
            detail={
                "event": "certificate_preflight_repeated_failure",
                "checked_at": "2026-03-12T07:00:00+00:00",
                "overall_status": "warning",
                "failure_keys": ["dns_public"],
            },
            created_at=datetime(2026, 3, 12, 7, 0, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:55:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 55, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:50:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 50, tzinfo=timezone.utc),
        ),
    ]

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES", 240)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES", 60)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result={
            "domain": "example.com",
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
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
    captured_records = []

    async def fake_record(**kwargs):
        captured_records.append(kwargs)

    previous_logs = [
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:55:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 55, tzinfo=timezone.utc),
        ),
    ]

    monkeypatch.setattr(preflight_service.audit_service, "record", fake_record)
    monkeypatch.setattr(preflight_service.settings, "CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD", 5)

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb(previous_logs),
        actor="admin",
        domain="example.com",
        result={
            "domain": "example.com",
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        },
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


@pytest.mark.asyncio
async def test_get_certificate_preflight_state_uses_runtime_config_override():
    logs = [
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T12:00:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            resource_name="example.com",
        ),
        SimpleNamespace(
            detail={
                "event": "certificate_preflight",
                "checked_at": "2026-03-12T11:55:00+00:00",
                "overall_status": "warning",
                "recommendation": "권한 DNS 응답을 먼저 확인하세요.",
                "items": [
                    {
                        "key": "dns_public",
                        "label": "공개 DNS 조회",
                        "status": "error",
                        "detail": "권한 NS 응답이 타임아웃되었습니다.",
                    }
                ],
            },
            created_at=datetime(2026, 3, 12, 11, 55, tzinfo=timezone.utc),
            resource_name="example.com",
        ),
    ]

    state = await preflight_service.get_certificate_preflight_state(
        StubAuditDb(logs),
        config=CertificateDiagnosticsSettings(
            auto_check_interval_minutes=60,
            repeat_alert_threshold=2,
            repeat_alert_window_minutes=240,
            repeat_alert_cooldown_minutes=240,
        ),
    )

    assert state["example.com"]["failure_streak"] == 2
    assert state["example.com"]["repeated_failure_active"] is True

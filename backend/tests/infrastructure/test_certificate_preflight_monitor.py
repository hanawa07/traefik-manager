from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.infrastructure.certificates import certificate_preflight_monitor


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
    preflight_calls = []

    async def list_certificates(self):
        return StubTraefikClient.certificates

    async def get_certificate_preflight(self, domain: str, certificates=None):
        StubTraefikClient.preflight_calls.append((domain, certificates))
        return {
            "domain": domain,
            "checked_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "overall_status": "warning",
            "recommendation": "권한 DNS 응답을 확인하세요.",
            "items": [
                {
                    "key": "dns_public",
                    "label": "공개 DNS 조회",
                    "status": "error",
                    "detail": "권한 NS 응답이 타임아웃되었습니다.",
                }
            ],
        }


@pytest.mark.asyncio
async def test_run_certificate_preflight_checks_once_scans_only_problematic_domains(monkeypatch):
    StubTraefikClient.certificates = [
        {
            "domain": "active.example.com",
            "status": "active",
            "last_acme_error_message": None,
        },
        {
            "domain": "inactive.example.com",
            "status": "inactive",
            "last_acme_error_message": None,
        },
        {
            "domain": "pending.example.com",
            "status": "pending",
            "last_acme_error_message": None,
        },
        {
            "domain": "warning.example.com",
            "status": "warning",
            "last_acme_error_message": None,
        },
        {
            "domain": "failed.example.com",
            "status": "active",
            "last_acme_error_message": "DNS timeout",
        },
    ]
    StubTraefikClient.preflight_calls = []
    recorded = []

    async def fake_record_certificate_preflight_result(**kwargs):
        recorded.append(kwargs)
        return {
            "previous_result": None,
            "repeated_failure_streak": 1,
            "repeated_failure_active": False,
            "repeated_failure_emitted": kwargs["domain"] == "failed.example.com",
        }

    monkeypatch.setattr(
        certificate_preflight_monitor,
        "record_certificate_preflight_result",
        fake_record_certificate_preflight_result,
    )

    result = await certificate_preflight_monitor.run_certificate_preflight_checks_once(
        session_factory=make_session,
        client_factory=StubTraefikClient,
        now=datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
    )

    assert result["candidate_count"] == 3
    assert result["checked_count"] == 3
    assert result["recorded_event_count"] == 1
    assert [item["domain"] for item in recorded] == [
        "pending.example.com",
        "warning.example.com",
        "failed.example.com",
    ]
    assert [domain for domain, _ in StubTraefikClient.preflight_calls] == [
        "pending.example.com",
        "warning.example.com",
        "failed.example.com",
    ]

import pytest

from app.application.certificate import preflight_service
from tests.application.certificate.preflight_service_fakes import (
    StubAuditDb,
    capture_audit_records,
    make_preflight_item,
    make_preflight_log,
    make_preflight_result,
    utc_dt,
)


@pytest.mark.asyncio
async def test_record_certificate_preflight_result_records_snapshot(monkeypatch):
    captured_records = capture_audit_records(monkeypatch)
    previous_log = make_preflight_log(
        checked_at=utc_dt(11, 45),
        overall_status="error",
        recommendation="직전에는 DNS timeout이 있어 권한 DNS를 먼저 확인해야 했습니다.",
        items=[
            make_preflight_item(
                status="error",
                detail="권한 NS 응답이 타임아웃되었습니다.",
            )
        ],
    )

    result = await preflight_service.record_certificate_preflight_result(
        db=StubAuditDb([previous_log]),
        actor="admin",
        domain="example.com",
        result=make_preflight_result(
            item_status="ok",
            item_detail="A 1개, AAAA 없음",
            recommendation="권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.",
        ),
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

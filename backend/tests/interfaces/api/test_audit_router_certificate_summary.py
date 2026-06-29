from datetime import datetime, timedelta, timezone

import pytest

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import StubAuditDb, make_log


@pytest.mark.asyncio
async def test_get_certificate_summary_counts_recent_events():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                event="certificate_warning",
                resource_type="certificate",
                resource_name="example.com",
                created_at=now - timedelta(minutes=5),
            ),
            make_log(
                event="certificate_error",
                resource_type="certificate",
                resource_name="expired.example.com",
                detail_extra={"previous_status": "warning", "checked_at": (now - timedelta(minutes=4)).isoformat()},
                created_at=now - timedelta(minutes=4),
            ),
            make_log(
                event="certificate_recovered",
                resource_type="certificate",
                resource_name="restored.example.com",
                detail_extra={"previous_status": "error", "checked_at": (now - timedelta(minutes=2)).isoformat()},
                created_at=now - timedelta(minutes=2),
            ),
            make_log(
                event="certificate_warning",
                resource_type="certificate",
                resource_name="old.example.com",
                created_at=now - timedelta(days=2),
            ),
            make_log(
                event="service_updated",
                resource_type="service",
                resource_name="svc",
                created_at=now - timedelta(minutes=3),
            ),
        ]
    )

    result = await audit_router.get_certificate_summary(
        window_minutes=60,
        recent_limit=2,
        db=db,
        _={"username": "admin"},
    )

    assert result.window_minutes == 60
    assert result.warning_count == 1
    assert result.error_count == 1
    assert result.recovered_count == 1
    assert [item.event for item in result.recent_events] == [
        "certificate_recovered",
        "certificate_error",
    ]
    assert result.recent_events[0].resource_name == "restored.example.com"
    assert result.recent_events[0].previous_status == "error"


@pytest.mark.asyncio
async def test_get_certificate_summary_accepts_naive_created_at():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(
                event="certificate_warning",
                resource_type="certificate",
                resource_name="naive.example.com",
                created_at=(now - timedelta(minutes=5)).replace(tzinfo=None),
            ),
            make_log(
                event="certificate_error",
                resource_type="certificate",
                resource_name="aware.example.com",
                created_at=now - timedelta(minutes=3),
            ),
        ]
    )

    result = await audit_router.get_certificate_summary(
        window_minutes=60,
        recent_limit=5,
        db=db,
        _={"username": "admin"},
    )

    assert result.warning_count == 1
    assert result.error_count == 1
    assert result.recent_events[0].resource_name == "aware.example.com"
    assert result.recent_events[1].resource_name == "naive.example.com"
    assert result.recent_events[1].created_at.tzinfo is not None

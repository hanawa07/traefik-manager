from datetime import datetime, timedelta, timezone

import pytest

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import StubAuditDb, make_log


@pytest.mark.asyncio
async def test_manager_health_summary_counts_selected_window(monkeypatch):
    now = datetime(2026, 7, 13, 3, 0, tzinfo=timezone.utc)
    db = StubAuditDb(
        [
            make_log(event="manager_docker_unhealthy", created_at=now - timedelta(hours=1)),
            make_log(event="manager_http_errors_high", created_at=now - timedelta(hours=1)),
            make_log(
                event="manager_http_log_storage_warning",
                created_at=now - timedelta(hours=1),
            ),
            make_log(
                event="manager_deployment_bottleneck_storage_warning",
                created_at=now - timedelta(hours=1),
            ),
            make_log(event="manager_watchdog_stale", created_at=now - timedelta(hours=2)),
            make_log(event="manager_docker_recovered", created_at=now - timedelta(hours=3)),
            make_log(event="manager_http_errors_recovered", created_at=now - timedelta(hours=4)),
            make_log(
                event="manager_http_log_storage_recovered",
                created_at=now - timedelta(hours=5),
            ),
            make_log(
                event="manager_deployment_bottleneck_storage_recovered",
                created_at=now - timedelta(hours=5),
            ),
            make_log(event="manager_watchdog_recovered", created_at=now - timedelta(days=2)),
        ]
    )

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr(audit_router, "datetime", FixedDatetime)
    result = await audit_router.get_manager_health_summary(
        window_minutes=1440,
        db=db,
        _={"username": "admin"},
    )

    assert result.window_minutes == 1440
    assert result.unhealthy_count == 5
    assert result.recovered_count == 4
    assert result.docker_unhealthy_count == 1
    assert result.docker_recovered_count == 1
    assert result.api_unhealthy_count == 3
    assert result.api_recovered_count == 3
    assert result.watchdog_unhealthy_count == 1
    assert result.watchdog_recovered_count == 0

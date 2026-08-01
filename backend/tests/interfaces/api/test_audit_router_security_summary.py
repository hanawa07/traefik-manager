from datetime import datetime, timedelta, timezone

import pytest

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import StubAuditDb, make_log


@pytest.mark.asyncio
async def test_get_security_summary_counts_recent_events():
    now = datetime.now(timezone.utc)
    db = StubAuditDb(
        [
            make_log(event="login_failure", resource_name="alice", client_ip="1.1.1.1", created_at=now - timedelta(minutes=5)),
            make_log(event="login_locked", resource_name="alice", client_ip="1.1.1.1", created_at=now - timedelta(minutes=4)),
            make_log(event="login_suspicious", resource_name="1.1.1.1", client_ip="1.1.1.1", created_at=now - timedelta(minutes=3)),
            make_log(event="login_blocked_ip", resource_name="1.1.1.1", client_ip="1.1.1.1", created_at=now - timedelta(minutes=2)),
            make_log(
                event="traefik_encoded_path_blocks_high",
                resource_type="traefik_security",
                resource_name="Traefik 인코딩 경로 차단",
                created_at=now - timedelta(seconds=30),
            ),
            make_log(event="service_updated", resource_type="service", resource_name="svc", created_at=now - timedelta(minutes=1)),
            make_log(event="login_locked", resource_name="old-user", client_ip="2.2.2.2", created_at=now - timedelta(days=2)),
        ]
    )

    result = await audit_router.get_security_summary(
        window_minutes=60,
        recent_limit=3,
        db=db,
        _={"username": "admin"},
    )

    assert result.window_minutes == 60
    assert result.failed_login_count == 1
    assert result.locked_login_count == 1
    assert result.suspicious_ip_count == 1
    assert result.blocked_ip_count == 1
    assert [item.event for item in result.recent_events] == [
        "traefik_encoded_path_blocks_high",
        "login_blocked_ip",
        "login_suspicious",
    ]
    assert result.recent_events[0].client_ip is None

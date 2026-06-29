from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.interfaces.api.v1.routers import audit as audit_router
from tests.interfaces.api.audit_router_fakes import StubAuditDb, make_log


@pytest.mark.asyncio
async def test_retry_delivery_replays_failed_delivery(monkeypatch):
    now = datetime.now(timezone.utc)
    target_log = make_log(
        action="alert",
        resource_type="settings",
        resource_name="보안 알림 전송 결과",
        event="security_alert_delivery_failure",
        created_at=now - timedelta(minutes=1),
        detail_extra={
            "provider": "slack",
            "source_event": "login_locked",
            "source_action": "update",
            "source_resource_type": "user",
            "source_resource_id": "user-1",
            "source_resource_name": "alice",
        },
    )
    db = StubAuditDb([target_log])
    called = []

    async def fake_retry(_db, log):
        called.append(log.id)
        return {
            "success": True,
            "message": "알림 전송을 다시 시도했습니다",
            "detail": "slack 채널로 전송했습니다",
            "provider": "slack",
            "source_event": "login_locked",
        }

    monkeypatch.setattr(audit_router.security_alert_notifier, "retry_delivery", fake_retry)

    result = await audit_router.retry_delivery(
        audit_log_id=target_log.id,
        db=db,
        _={"username": "admin"},
    )

    assert called == [target_log.id]
    assert result.success is True
    assert result.provider == "slack"
    assert result.source_event == "login_locked"


@pytest.mark.asyncio
async def test_retry_delivery_returns_404_when_log_missing():
    db = StubAuditDb([])

    with pytest.raises(audit_router.HTTPException) as exc_info:
        await audit_router.retry_delivery(
            audit_log_id=uuid4(),
            db=db,
            _={"username": "admin"},
        )

    assert exc_info.value.status_code == 404

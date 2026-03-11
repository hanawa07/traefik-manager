from datetime import datetime, timezone

import pytest

from app.application.audit import audit_service


class StubDbSession:
    def __init__(self):
        self.added = []
        self.flushed = False

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushed = True


@pytest.mark.asyncio
async def test_record_triggers_security_alert_notifier_for_recorded_log(monkeypatch):
    db = StubDbSession()
    notified = []

    async def fake_notify_if_needed(db_session, audit_log):
        notified.append((db_session, audit_log))
        return True

    monkeypatch.setattr(audit_service.security_alert_notifier, "notify_if_needed", fake_notify_if_needed)

    await audit_service.record(
        db=db,
        actor="system",
        action="update",
        resource_type="user",
        resource_id="abc",
        resource_name="alice",
        detail={"event": "login_suspicious", "client_ip": "1.2.3.4"},
    )

    assert db.flushed is True
    assert len(db.added) == 1
    assert notified[0][0] is db
    assert notified[0][1].detail["event"] == "login_suspicious"

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.infrastructure.notifications import security_alert_notifier


class StubSettingsRepository:
    values: dict[str, str] = {}

    def __init__(self, _session):
        self.values = StubSettingsRepository.values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


def make_audit_log(event: str):
    return SimpleNamespace(
        actor="system",
        action="update",
        resource_type="user",
        resource_id="abc",
        resource_name="alice",
        detail={"event": event, "client_ip": "1.2.3.4"},
        created_at=datetime(2026, 3, 11, 17, 0, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_notify_if_needed_skips_when_disabled(monkeypatch):
    posted = []

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *_args, **_kwargs):
            posted.append(True)

    StubSettingsRepository.values = {
        "security_alerts_enabled": "false",
        "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_posts_payload_for_supported_security_event(monkeypatch):
    posted = []

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            posted.append((url, json))

    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://hooks.example.com/security-alerts"
    assert posted[0][1]["event"] == "login_blocked_ip"
    assert posted[0][1]["client_ip"] == "1.2.3.4"
    assert posted[0][1]["source"] == "traefik-manager"


@pytest.mark.asyncio
async def test_notify_if_needed_skips_unsupported_event(monkeypatch):
    posted = []

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *_args, **_kwargs):
            posted.append(True)

    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_failure"))

    assert result is False
    assert posted == []

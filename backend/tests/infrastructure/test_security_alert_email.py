from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.infrastructure.notifications import security_alert_email


class StubSettingsRepository:
    def __init__(self, values: dict[str, str]):
        self.values = values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


def make_audit_log():
    return SimpleNamespace(
        actor="system",
        resource_name="alice",
        detail={"client_ip": "203.0.113.10"},
        created_at=datetime(2026, 3, 11, 17, 0, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_build_email_settings_normalizes_values():
    repo = StubSettingsRepository(
        {
            "security_alert_email_host": " smtp.example.com ",
            "security_alert_email_port": "not-a-port",
            "security_alert_email_security": "invalid",
            "security_alert_email_username": " alerts@example.com ",
            "security_alert_email_password": " secret ",
            "security_alert_email_from": " alerts@example.com ",
            "security_alert_email_recipients": "ops@example.com, dev@example.com\nsec@example.com",
        }
    )

    result = await security_alert_email.build_email_settings(repo)

    assert result == {
        "host": "smtp.example.com",
        "port": 587,
        "security": "starttls",
        "username": "alerts@example.com",
        "password": "secret",
        "from_email": "alerts@example.com",
        "recipients": ["ops@example.com", "dev@example.com", "sec@example.com"],
    }


@pytest.mark.asyncio
async def test_build_email_settings_returns_none_when_required_values_missing():
    repo = StubSettingsRepository({"security_alert_email_host": "smtp.example.com"})

    assert await security_alert_email.build_email_settings(repo) is None


@pytest.mark.asyncio
async def test_send_email_alert_with_detail_uses_sync_sender(monkeypatch):
    sent = []

    def fake_send_email_sync(email_settings, audit_log, event, category):
        sent.append((email_settings, audit_log, event, category))

    repo = StubSettingsRepository(
        {
            "security_alert_email_host": "smtp.example.com",
            "security_alert_email_from": "alerts@example.com",
            "security_alert_email_recipients": "ops@example.com",
        }
    )
    monkeypatch.setattr(security_alert_email, "send_email_sync", fake_send_email_sync)

    success, detail = await security_alert_email.send_email_alert_with_detail(
        repo,
        make_audit_log(),
        "login_suspicious",
        "security",
    )

    assert success is True
    assert detail == "email 채널로 전송했습니다"
    assert sent[0][2:] == ("login_suspicious", "security")

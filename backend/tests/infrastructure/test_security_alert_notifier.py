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


def make_audit_log(
    event: str,
    *,
    resource_type: str = "user",
    resource_id: str = "abc",
    resource_name: str = "alice",
):
    return SimpleNamespace(
        actor="system",
        action="update",
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
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
async def test_notify_if_needed_formats_slack_payload(monkeypatch):
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
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_locked"))

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "text" in posted[0][1]
    assert "blocks" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_formats_discord_payload(monkeypatch):
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
        "security_alert_provider": "discord",
        "security_alert_webhook_url": "https://discord.com/api/webhooks/123/abc",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is True
    assert posted[0][0] == "https://discord.com/api/webhooks/123/abc"
    assert "content" in posted[0][1]
    assert "embeds" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_formats_teams_payload(monkeypatch):
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
        "security_alert_provider": "teams",
        "security_alert_webhook_url": "https://example.webhook.office.com/webhookb2/abc",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_locked"))

    assert result is True
    assert posted[0][0] == "https://example.webhook.office.com/webhookb2/abc"
    assert posted[0][1]["type"] == "message"
    assert posted[0][1]["attachments"][0]["contentType"] == "application/vnd.microsoft.card.adaptive"


@pytest.mark.asyncio
async def test_notify_if_needed_formats_pagerduty_payload(monkeypatch):
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
        "security_alert_provider": "pagerduty",
        "security_alert_pagerduty_routing_key": "pd-secret",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://events.pagerduty.com/v2/enqueue"
    assert posted[0][1]["routing_key"] == "pd-secret"
    assert posted[0][1]["event_action"] == "trigger"
    assert posted[0][1]["payload"]["severity"] == "critical"


@pytest.mark.asyncio
async def test_notify_if_needed_sends_email_alert(monkeypatch):
    sent = []

    async def stub_send_email_alert(repo, audit_log, event, category):
        sent.append((repo, audit_log, event, category))
        return True

    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "email",
        "security_alert_email_host": "smtp.example.com",
        "security_alert_email_port": "587",
        "security_alert_email_security": "starttls",
        "security_alert_email_from": "alerts@example.com",
        "security_alert_email_recipients": "ops@example.com",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier, "_send_email_alert", stub_send_email_alert)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is True
    assert sent[0][2] == "login_suspicious"
    assert sent[0][3] == "security"


@pytest.mark.asyncio
async def test_notify_if_needed_formats_telegram_payload(monkeypatch):
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
        "security_alert_provider": "telegram",
        "security_alert_telegram_bot_token": "telegram-secret",
        "security_alert_telegram_chat_id": "10001",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://api.telegram.org/bottelegram-secret/sendMessage"
    assert posted[0][1]["chat_id"] == "10001"
    assert "text" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_routes_event_to_override_provider(monkeypatch):
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
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        "security_alert_route_login_blocked_ip": "pagerduty",
        "security_alert_pagerduty_routing_key": "pd-secret",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://events.pagerduty.com/v2/enqueue"
    assert posted[0][1]["routing_key"] == "pd-secret"
    assert posted[0][1]["payload"]["class"] == "login_blocked_ip"


@pytest.mark.asyncio
async def test_notify_if_needed_skips_disabled_event_route(monkeypatch):
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
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        "security_alert_route_login_suspicious": "disabled",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is False
    assert posted == []


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


@pytest.mark.asyncio
async def test_notify_if_needed_posts_operational_change_when_enabled(monkeypatch):
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
        "change_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        "security_alert_change_route_service_change": "default",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log("service_update", resource_type="service", resource_id="svc-1", resource_name="svc"),
    )

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "service_update" in str(posted[0][1])


@pytest.mark.asyncio
async def test_notify_if_needed_skips_disabled_operational_change_route(monkeypatch):
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
        "change_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        "security_alert_change_route_rollback": "disabled",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log("service_rollback", resource_type="service", resource_id="svc-1", resource_name="svc"),
    )

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_posts_certificate_change_when_enabled(monkeypatch):
    posted = []

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            posted.append((url, json))

    audit_log = make_audit_log(
        "certificate_warning",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail["days_remaining"] = 12

    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "change_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        "security_alert_change_route_certificate_change": "default",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "certificate_warning" in str(posted[0][1])

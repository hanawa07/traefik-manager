from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
import httpx

from app.infrastructure.notifications import security_alert_notifier


class StubSettingsRepository:
    values: dict[str, str] = {}

    def __init__(self, _session):
        self.values = StubSettingsRepository.values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


class StubDB:
    def __init__(self):
        self.added = []
        self.flush_calls = 0

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flush_calls += 1


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


def make_delivery_log(
    event: str,
    *,
    provider: str = "slack",
    source_event: str = "login_locked",
):
    return SimpleNamespace(
        id=uuid4(),
        actor="system",
        action="alert",
        resource_type="settings",
        resource_id="security-alert-delivery",
        resource_name="보안 알림 전송 결과",
        detail={
            "event": event,
            "provider": provider,
            "source_event": source_event,
            "source_action": "update",
            "source_resource_type": "user",
            "source_resource_id": "abc",
            "source_resource_name": "alice",
            "client_ip": "1.2.3.4",
        },
        created_at=datetime(2026, 3, 12, 9, 0, tzinfo=timezone.utc),
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
async def test_notify_if_needed_records_successful_delivery_audit(monkeypatch):
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
    db = StubDB()

    result = await security_alert_notifier.notify_if_needed(db, make_audit_log("login_locked"))

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert len(db.added) == 1
    assert db.flush_calls == 1
    delivery_log = db.added[0]
    assert delivery_log.action == "alert"
    assert delivery_log.resource_type == "settings"
    assert delivery_log.resource_name == "보안 알림 전송 결과"
    assert delivery_log.detail["event"] == "security_alert_delivery_success"
    assert delivery_log.detail["source_event"] == "login_locked"
    assert delivery_log.detail["provider"] == "slack"
    assert delivery_log.detail["success"] is True


@pytest.mark.asyncio
async def test_notify_if_needed_records_failed_delivery_audit(monkeypatch):
    request = httpx.Request("POST", "https://hooks.slack.com/services/AAA/BBB/CCC")

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, _url, json=None):
            raise httpx.ConnectError("network down", request=request)

    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())
    db = StubDB()

    result = await security_alert_notifier.notify_if_needed(db, make_audit_log("login_suspicious"))

    assert result is False
    assert len(db.added) == 1
    assert db.flush_calls == 1
    delivery_log = db.added[0]
    assert delivery_log.action == "alert"
    assert delivery_log.resource_type == "settings"
    assert delivery_log.detail["event"] == "security_alert_delivery_failure"
    assert delivery_log.detail["source_event"] == "login_suspicious"
    assert delivery_log.detail["provider"] == "slack"
    assert delivery_log.detail["success"] is False
    assert "network down" in delivery_log.detail["detail"]


@pytest.mark.asyncio
async def test_retry_delivery_replays_failed_delivery_with_original_provider(monkeypatch):
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
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())
    db = StubDB()
    delivery_log = make_delivery_log("security_alert_delivery_failure", provider="slack")

    result = await security_alert_notifier.retry_delivery(db, delivery_log)

    assert result["success"] is True
    assert result["provider"] == "slack"
    assert result["source_event"] == "login_locked"
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert len(db.added) == 1
    retry_result_log = db.added[0]
    assert retry_result_log.detail["event"] == "security_alert_delivery_success"
    assert retry_result_log.detail["trigger"] == "manual_retry"
    assert retry_result_log.detail["retry_of_audit_id"] == str(delivery_log.id)


@pytest.mark.asyncio
async def test_retry_delivery_rejects_non_failed_delivery_event(monkeypatch):
    StubSettingsRepository.values = {
        "security_alerts_enabled": "true",
        "security_alert_provider": "slack",
        "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)

    with pytest.raises(ValueError):
        await security_alert_notifier.retry_delivery(
            StubDB(),
            make_delivery_log("security_alert_delivery_success"),
        )


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
        return True, "email 채널로 전송했습니다"

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
    monkeypatch.setattr(security_alert_notifier, "_send_email_alert_with_detail", stub_send_email_alert)

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
@pytest.mark.parametrize(
    ("event", "resource_type", "route_key"),
    [
        ("service_create", "service", "security_alert_change_route_service_change"),
        ("service_delete", "service", "security_alert_change_route_service_change"),
        ("redirect_create", "redirect", "security_alert_change_route_redirect_change"),
        ("redirect_delete", "redirect", "security_alert_change_route_redirect_change"),
        ("middleware_create", "middleware", "security_alert_change_route_middleware_change"),
        ("middleware_delete", "middleware", "security_alert_change_route_middleware_change"),
        ("user_create", "user", "security_alert_change_route_user_change"),
        ("user_delete", "user", "security_alert_change_route_user_change"),
    ],
)
async def test_notify_if_needed_posts_operational_create_delete_when_enabled(
    monkeypatch,
    event,
    resource_type,
    route_key,
):
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
        route_key: "default",
    }
    monkeypatch.setattr(security_alert_notifier, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(security_alert_notifier.httpx, "AsyncClient", lambda **_kwargs: StubClient())

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log(event, resource_type=resource_type, resource_id=f"{resource_type}-1", resource_name=resource_type),
    )

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert event in str(posted[0][1])


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


@pytest.mark.asyncio
async def test_notify_if_needed_posts_certificate_recovered_when_enabled(monkeypatch):
    posted = []

    class StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            posted.append((url, json))

    audit_log = make_audit_log(
        "certificate_recovered",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail["previous_status"] = "error"

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
    assert "certificate_recovered" in str(posted[0][1])

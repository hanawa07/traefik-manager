import pytest

from app.infrastructure.notifications import security_alert_notifier
from tests.infrastructure.security_alert_notifier_fakes import (
    make_audit_log,
    patch_http_client,
    patch_settings,
)


@pytest.mark.asyncio
async def test_notify_if_needed_formats_slack_payload(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_locked"))

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "text" in posted[0][1]
    assert "blocks" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_formats_discord_payload(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "discord",
            "security_alert_webhook_url": "https://discord.com/api/webhooks/123/abc",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is True
    assert posted[0][0] == "https://discord.com/api/webhooks/123/abc"
    assert "content" in posted[0][1]
    assert "embeds" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_formats_teams_payload(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "teams",
            "security_alert_webhook_url": "https://example.webhook.office.com/webhookb2/abc",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_locked"))

    assert result is True
    assert posted[0][0] == "https://example.webhook.office.com/webhookb2/abc"
    assert posted[0][1]["type"] == "message"
    assert posted[0][1]["attachments"][0]["contentType"] == "application/vnd.microsoft.card.adaptive"


@pytest.mark.asyncio
async def test_notify_if_needed_formats_pagerduty_payload(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "pagerduty",
            "security_alert_pagerduty_routing_key": "pd-secret",
        },
    )
    patch_http_client(monkeypatch, posted)

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

    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "email",
            "security_alert_email_host": "smtp.example.com",
            "security_alert_email_port": "587",
            "security_alert_email_security": "starttls",
            "security_alert_email_from": "alerts@example.com",
            "security_alert_email_recipients": "ops@example.com",
        },
    )
    monkeypatch.setattr(security_alert_notifier, "_send_email_alert_with_detail", stub_send_email_alert)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is True
    assert sent[0][2] == "login_suspicious"
    assert sent[0][3] == "security"


@pytest.mark.asyncio
async def test_notify_if_needed_formats_telegram_payload(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://api.telegram.org/bottelegram-secret/sendMessage"
    assert posted[0][1]["chat_id"] == "10001"
    assert "text" in posted[0][1]


@pytest.mark.asyncio
async def test_notify_if_needed_routes_event_to_override_provider(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_route_login_blocked_ip": "pagerduty",
            "security_alert_pagerduty_routing_key": "pd-secret",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://events.pagerduty.com/v2/enqueue"
    assert posted[0][1]["routing_key"] == "pd-secret"
    assert posted[0][1]["payload"]["class"] == "login_blocked_ip"


@pytest.mark.asyncio
async def test_notify_if_needed_skips_disabled_event_route(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_route_login_suspicious": "disabled",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_skips_unsupported_event(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_failure"))

    assert result is False
    assert posted == []

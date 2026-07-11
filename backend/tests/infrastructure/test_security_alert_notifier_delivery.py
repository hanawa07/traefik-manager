from uuid import uuid4

import httpx
import pytest

from app.infrastructure.notifications import security_alert_notifier
from tests.infrastructure.security_alert_notifier_fakes import (
    StubDB,
    make_audit_log,
    make_delivery_log,
    patch_http_client,
    patch_settings,
)


@pytest.mark.asyncio
async def test_notify_if_needed_skips_when_disabled(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "false",
            "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_suspicious"))

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_posts_payload_for_supported_security_event(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_webhook_url": "https://hooks.example.com/security-alerts",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), make_audit_log("login_blocked_ip"))

    assert result is True
    assert posted[0][0] == "https://hooks.example.com/security-alerts"
    assert posted[0][1]["event"] == "login_blocked_ip"
    assert posted[0][1]["client_ip"] == "1.2.3.4"
    assert posted[0][1]["source"] == "traefik-manager"


@pytest.mark.asyncio
async def test_notify_if_needed_records_successful_delivery_audit(monkeypatch):
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
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
    )
    patch_http_client(monkeypatch, error=httpx.ConnectError("network down", request=request))
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
async def test_notify_if_needed_records_http_status_failure(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
    )
    patch_http_client(monkeypatch, posted, status_code=503)
    db = StubDB()

    result = await security_alert_notifier.notify_if_needed(db, make_audit_log("login_suspicious"))

    assert result is False
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    delivery_log = db.added[0]
    assert delivery_log.detail["event"] == "security_alert_delivery_failure"
    assert delivery_log.detail["success"] is False
    assert "503 Service Unavailable" in delivery_log.detail["detail"]


@pytest.mark.asyncio
async def test_notify_if_needed_redacts_telegram_token_in_failed_delivery_audit(monkeypatch):
    token = "123456:ABC-secret"
    request_url = f"https://api.telegram.org/bot{token}/sendMessage"
    request = httpx.Request("POST", request_url)
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": token,
            "security_alert_telegram_chat_id": "10001",
        },
    )
    patch_http_client(
        monkeypatch,
        error=httpx.ConnectError(f"network down: {request_url}", request=request),
    )
    db = StubDB()

    result = await security_alert_notifier.notify_if_needed(db, make_audit_log("login_suspicious"))

    assert result is False
    detail = db.added[0].detail["detail"]
    assert token not in detail
    assert "https://api.telegram.org/bot<redacted>/sendMessage" in detail


@pytest.mark.asyncio
async def test_notify_if_needed_records_actionable_timeout_detail(monkeypatch):
    token = "123456:ABC-secret"
    request_url = f"https://api.telegram.org/bot{token}/sendMessage"
    request = httpx.Request("POST", request_url)
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": token,
            "security_alert_telegram_chat_id": "10001",
        },
    )
    patch_http_client(monkeypatch, error=httpx.ConnectTimeout("", request=request))
    db = StubDB()

    result = await security_alert_notifier.notify_if_needed(db, make_audit_log("login_suspicious"))

    assert result is False
    detail = db.added[0].detail["detail"]
    assert token not in detail
    assert detail == (
        "ConnectTimeout: 요청 제한 시간 초과 "
        "(POST https://api.telegram.org/bot<redacted>/sendMessage)"
    )


@pytest.mark.asyncio
async def test_retry_delivery_replays_failed_delivery_with_original_provider(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "discord",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
    )
    patch_http_client(monkeypatch, posted)
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
async def test_retry_delivery_tracks_automatic_retry_attempt(monkeypatch):
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
    db = StubDB()
    delivery_log = make_delivery_log("security_alert_delivery_failure", provider="slack")
    root_audit_id = str(uuid4())
    delivery_log.detail["retry_of_audit_id"] = root_audit_id

    await security_alert_notifier.retry_delivery(
        db,
        delivery_log,
        trigger="automatic_retry",
    )

    retry_result_log = db.added[0]
    assert retry_result_log.detail["trigger"] == "automatic_retry"
    assert retry_result_log.detail["auto_retry_attempt"] == 1
    assert retry_result_log.detail["retry_root_audit_id"] == root_audit_id


@pytest.mark.asyncio
async def test_retry_delivery_rejects_non_failed_delivery_event(monkeypatch):
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
        },
    )

    with pytest.raises(ValueError):
        await security_alert_notifier.retry_delivery(
            StubDB(),
            make_delivery_log("security_alert_delivery_success"),
        )

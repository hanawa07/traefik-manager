import pytest

from app.infrastructure.notifications import security_alert_notifier
from tests.infrastructure.security_alert_notifier_fakes import (
    make_audit_log,
    patch_http_client,
    patch_settings,
)


@pytest.mark.asyncio
async def test_notify_if_needed_posts_operational_change_when_enabled(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_service_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

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
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            route_key: "default",
        },
    )
    patch_http_client(monkeypatch, posted)

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
    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_rollback": "disabled",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log("service_rollback", resource_type="service", resource_id="svc-1", resource_name="svc"),
    )

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_posts_certificate_change_when_enabled(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "certificate_warning",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail["days_remaining"] = 12

    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_certificate_status_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "certificate_warning" in str(posted[0][1])


@pytest.mark.asyncio
async def test_notify_if_needed_posts_certificate_recovered_when_enabled(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "certificate_recovered",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail["previous_status"] = "error"

    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_certificate_status_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "certificate_recovered" in str(posted[0][1])


@pytest.mark.asyncio
async def test_notify_if_needed_posts_certificate_preflight_repeated_failure_when_enabled(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "certificate_preflight_repeated_failure",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail["consecutive_count"] = 3
    audit_log.detail["failure_keys"] = ["dns_public"]

    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_certificate_preflight_failure": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"
    assert "certificate_preflight_repeated_failure" in str(posted[0][1])


@pytest.mark.asyncio
async def test_notify_if_needed_uses_legacy_certificate_route_for_split_groups(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "certificate_preflight_repeated_failure",
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )

    patch_settings(
        monkeypatch,
        {
            "security_alerts_enabled": "true",
            "change_alerts_enabled": "true",
            "security_alert_provider": "slack",
            "security_alert_webhook_url": "https://hooks.slack.com/services/AAA/BBB/CCC",
            "security_alert_change_route_certificate_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == "https://hooks.slack.com/services/AAA/BBB/CCC"

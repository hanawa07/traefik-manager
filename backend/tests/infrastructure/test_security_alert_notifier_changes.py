import pytest

from app.infrastructure.notifications import security_alert_notifier
from tests.infrastructure.security_alert_notifier_fakes import (
    make_audit_log,
    patch_http_client,
    patch_settings,
)

SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/AAA/BBB/CCC"
SLACK_CHANGE_SETTINGS = {
    "security_alerts_enabled": "true",
    "change_alerts_enabled": "true",
    "security_alert_provider": "slack",
    "security_alert_webhook_url": SLACK_WEBHOOK_URL,
}
TELEGRAM_CHANGE_SETTINGS = {
    "change_alerts_enabled": "true",
    "security_alert_provider": "telegram",
    "security_alert_telegram_bot_token": "telegram-secret",
    "security_alert_telegram_chat_id": "10001",
}


@pytest.mark.asyncio
async def test_notify_if_needed_posts_smoke_rotation_failure(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "smoke_rotation_failed",
        resource_type="user",
        resource_id="traefik-smoke-viewer",
        resource_name="traefik-smoke-viewer",
    )
    audit_log.detail["step"] = "GitHub secret 갱신"
    patch_settings(
        monkeypatch,
        {
            **TELEGRAM_CHANGE_SETTINGS,
            "security_alert_change_route_settings_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "스모크 계정 비밀번호 회전 실패" in posted[0][1]["text"]
    assert "실패 단계: GitHub secret 갱신" in posted[0][1]["text"]


@pytest.mark.asyncio
async def test_notify_if_needed_posts_github_rate_limit_threshold(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "github_api_secondary_rate_limit",
        resource_type="settings",
        resource_id="github_api_secondary_rate_limit",
        resource_name="GitHub API 보조 요청 제한",
    )
    audit_log.detail.update(
        {
            "alert_threshold": 3,
            "alert_window_hours": 24,
            "window_occurrence_count": 3,
        }
    )
    patch_settings(
        monkeypatch,
        {
            **TELEGRAM_CHANGE_SETTINGS,
            "security_alert_change_route_manager_health": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "GitHub API 보조 요청 제한 반복" in posted[0][1]["text"]
    assert "집계 구간: 최근 24시간" in posted[0][1]["text"]
    assert "발생 횟수: 3회 / 임계치 3회" in posted[0][1]["text"]


@pytest.mark.asyncio
@pytest.mark.parametrize("resource_name", ["traefik-smoke-viewer", "traefik-smoke-admin"])
async def test_notify_if_needed_skips_routine_smoke_password_rotation(
    monkeypatch,
    resource_name,
):
    posted = []
    audit_log = make_audit_log(
        "user_update",
        resource_type="user",
        resource_id="smoke-viewer",
        resource_name=resource_name,
    )
    audit_log.detail["changed_keys"] = ["password_changed"]
    patch_settings(monkeypatch, TELEGRAM_CHANGE_SETTINGS)
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is False
    assert posted == []


@pytest.mark.asyncio
async def test_notify_if_needed_keeps_smoke_viewer_role_change_alert(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "user_update",
        resource_type="user",
        resource_id="smoke-viewer",
        resource_name="traefik-smoke-viewer",
    )
    audit_log.detail["changed_keys"] = ["password_changed", "role"]
    patch_settings(
        monkeypatch,
        {
            **TELEGRAM_CHANGE_SETTINGS,
            "security_alert_change_route_user_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "사용자 변경: traefik-smoke-viewer" in posted[0][1]["text"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("event", "resource_type", "route_key"),
    [
        ("service_update", "service", "security_alert_change_route_service_change"),
        ("service_create", "service", "security_alert_change_route_service_change"),
        ("service_delete", "service", "security_alert_change_route_service_change"),
        ("redirect_create", "redirect", "security_alert_change_route_redirect_change"),
        ("redirect_delete", "redirect", "security_alert_change_route_redirect_change"),
        (
            "middleware_create",
            "middleware",
            "security_alert_change_route_middleware_change",
        ),
        (
            "middleware_delete",
            "middleware",
            "security_alert_change_route_middleware_change",
        ),
        ("user_create", "user", "security_alert_change_route_user_change"),
        ("user_delete", "user", "security_alert_change_route_user_change"),
    ],
)
async def test_notify_if_needed_posts_operational_change_when_enabled(
    monkeypatch,
    event,
    resource_type,
    route_key,
):
    posted = []
    patch_settings(monkeypatch, {**SLACK_CHANGE_SETTINGS, route_key: "default"})
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log(
            event,
            resource_type=resource_type,
            resource_id=f"{resource_type}-1",
            resource_name=resource_type,
        ),
    )

    assert result is True
    assert posted[0][0] == SLACK_WEBHOOK_URL
    assert event in str(posted[0][1])


@pytest.mark.asyncio
async def test_notify_if_needed_skips_disabled_operational_change_route(monkeypatch):
    posted = []
    patch_settings(
        monkeypatch,
        {
            **SLACK_CHANGE_SETTINGS,
            "security_alert_change_route_rollback": "disabled",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(
        object(),
        make_audit_log(
            "service_rollback",
            resource_type="service",
            resource_id="svc-1",
            resource_name="svc",
        ),
    )

    assert result is False
    assert posted == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("event", "route_key", "detail"),
    [
        (
            "certificate_warning",
            "security_alert_change_route_certificate_status_change",
            {"days_remaining": 12},
        ),
        (
            "certificate_recovered",
            "security_alert_change_route_certificate_status_change",
            {"previous_status": "error"},
        ),
        (
            "certificate_preflight_repeated_failure",
            "security_alert_change_route_certificate_preflight_failure",
            {"consecutive_count": 3, "failure_keys": ["dns_public"]},
        ),
    ],
)
async def test_notify_if_needed_posts_certificate_change_when_enabled(
    monkeypatch,
    event,
    route_key,
    detail,
):
    posted = []
    audit_log = make_audit_log(
        event,
        resource_type="certificate",
        resource_id="example.com",
        resource_name="example.com",
    )
    audit_log.detail.update(detail)
    patch_settings(monkeypatch, {**SLACK_CHANGE_SETTINGS, route_key: "default"})
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == SLACK_WEBHOOK_URL
    assert event in str(posted[0][1])


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
            **SLACK_CHANGE_SETTINGS,
            "security_alert_change_route_certificate_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert posted[0][0] == SLACK_WEBHOOK_URL

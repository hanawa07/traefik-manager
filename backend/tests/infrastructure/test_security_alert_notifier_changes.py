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
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
            "security_alert_change_route_settings_change": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "스모크 viewer 비밀번호 회전 실패" in posted[0][1]["text"]
    assert "실패 단계: GitHub secret 갱신" in posted[0][1]["text"]


@pytest.mark.asyncio
async def test_notify_if_needed_skips_routine_smoke_viewer_password_rotation(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "user_update",
        resource_type="user",
        resource_id="smoke-viewer",
        resource_name="traefik-smoke-viewer",
    )
    audit_log.detail["changed_keys"] = ["password_changed"]
    patch_settings(
        monkeypatch,
        {
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
        },
    )
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
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
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
async def test_notify_if_needed_posts_manager_health_to_telegram(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "manager_docker_unhealthy",
        resource_type="manager_component",
        resource_id="frontend",
        resource_name="frontend",
    )
    audit_log.detail.update(
        {
            "health_status": "unhealthy",
            "failing_streak": 3,
            "last_exit_code": 1,
            "health_checked_at": "2026-07-12T18:00:00Z",
            "cooldown_minutes": 60,
        }
    )
    patch_settings(
        monkeypatch,
        {
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
            "security_alert_change_route_manager_health": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "Manager Docker 이상: frontend" in posted[0][1]["text"]
    assert "연속 실패: 3회" in posted[0][1]["text"]
    assert "재발 알림 cooldown: 60분" in posted[0][1]["text"]


@pytest.mark.asyncio
async def test_notify_if_needed_posts_manager_http_error_threshold_to_telegram(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "manager_http_errors_high",
        resource_type="manager_component",
        resource_id="backend-api",
        resource_name="Manager API",
    )
    audit_log.detail.update(
        {
            "window_minutes": 15,
            "not_found_count": 25,
            "not_found_threshold": 20,
            "server_error_count": 2,
            "server_error_threshold": 1,
            "cooldown_minutes": 60,
        }
    )
    patch_settings(
        monkeypatch,
        {
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
            "security_alert_change_route_manager_health": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "Manager API 오류 임계치 초과" in posted[0][1]["text"]
    assert "404: 25건 / 임계치 20건" in posted[0][1]["text"]
    assert "5xx: 2건 / 임계치 1건" in posted[0][1]["text"]


@pytest.mark.asyncio
async def test_notify_if_needed_posts_manager_log_storage_warning_to_telegram(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "manager_http_log_storage_warning",
        resource_type="manager_component",
        resource_id="request-log-storage",
        resource_name="Manager 요청 로그",
    )
    audit_log.detail.update(
        {
            "status": "capacity",
            "source": "persistent",
            "size_bytes": 800,
            "capacity_bytes": 1_000,
            "usage_percent": 80.0,
            "file_count": 5,
            "max_file_count": 6,
            "rotated_file_count": 4,
            "cooldown_minutes": 60,
        }
    )
    patch_settings(
        monkeypatch,
        {
            "change_alerts_enabled": "true",
            "security_alert_provider": "telegram",
            "security_alert_telegram_bot_token": "telegram-secret",
            "security_alert_telegram_chat_id": "10001",
            "security_alert_change_route_manager_health": "default",
        },
    )
    patch_http_client(monkeypatch, posted)

    result = await security_alert_notifier.notify_if_needed(object(), audit_log)

    assert result is True
    assert "Manager 요청 로그 보관 경고" in posted[0][1]["text"]
    assert "보관 상태: capacity" in posted[0][1]["text"]
    assert "사용량: 800 / 1000 bytes (80.0%)" in posted[0][1]["text"]


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

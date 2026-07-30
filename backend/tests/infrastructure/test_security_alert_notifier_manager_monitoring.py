import pytest

from app.infrastructure.notifications import security_alert_notifier
from tests.infrastructure.security_alert_notifier_fakes import (
    make_audit_log,
    patch_http_client,
    patch_settings,
)


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
async def test_notify_if_needed_posts_settings_history_latency_to_telegram(monkeypatch):
    posted = []
    audit_log = make_audit_log(
        "manager_settings_history_latency_high",
        resource_type="manager_component",
        resource_id="settings-test-history",
        resource_name="설정 이력 API",
    )
    audit_log.detail.update(
        {
            "path": "/api/v1/settings/test-history",
            "window_minutes": 60,
            "sample_count": 10,
            "minimum_sample_count": 5,
            "p95_ms": 180.0,
            "threshold_ms": 100.0,
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
    assert "Manager 설정 이력 API 지연" in posted[0][1]["text"]
    assert "p95: 180.0ms / 기준 100.0ms" in posted[0][1]["text"]
    assert "표본: 10건 / 최소 5건" in posted[0][1]["text"]


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

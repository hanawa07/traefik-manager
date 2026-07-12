import pytest

from app.interfaces.api.v1.routers import settings as settings_router
from tests.interfaces.api.settings_security_alert_router_fakes import ADMIN, patch_settings_repository


@pytest.mark.asyncio
async def test_get_security_alert_settings_returns_defaults(monkeypatch):
    patch_settings_repository(monkeypatch)

    response = await settings_router.get_security_alert_settings(db=object(), _=ADMIN)

    assert response.enabled is False
    assert response.provider == "generic"
    assert response.webhook_url is None
    assert response.telegram_bot_token_configured is False
    assert response.telegram_chat_id is None
    assert response.pagerduty_routing_key_configured is False
    assert response.email_host is None
    assert response.email_port == 587
    assert response.email_security == "starttls"
    assert response.email_username is None
    assert response.email_password_configured is False
    assert response.email_from is None
    assert response.email_recipients == []
    assert response.timeout_seconds == 5.0
    assert response.alert_events == ["login_locked", "login_suspicious", "login_blocked_ip"]
    assert response.event_routes == {
        "login_locked": "default",
        "login_suspicious": "default",
        "login_blocked_ip": "default",
    }
    assert response.change_alerts_enabled is False
    assert response.manager_health_monitoring_enabled is True
    assert response.manager_health_alert_cooldown_minutes == 60
    assert response.change_event_routes == {
        "settings_change": "default",
        "service_change": "default",
        "redirect_change": "default",
        "middleware_change": "default",
        "user_change": "default",
        "certificate_status_change": "default",
        "certificate_preflight_failure": "default",
        "manager_health": "default",
        "rollback": "default",
    }


@pytest.mark.asyncio
async def test_get_security_alert_settings_maps_legacy_certificate_route(monkeypatch):
    patch_settings_repository(
        monkeypatch,
        {
            "change_alerts_enabled": "true",
            "security_alert_change_route_certificate_change": "email",
        },
    )

    response = await settings_router.get_security_alert_settings(db=object(), _=ADMIN)

    assert response.change_event_routes["certificate_status_change"] == "email"
    assert response.change_event_routes["certificate_preflight_failure"] == "email"

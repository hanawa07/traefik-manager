import json

import pytest

from app.application.manager_http_error_monitoring import (
    normalize_manager_http_excluded_paths,
    read_manager_http_error_monitor_status,
    read_manager_http_error_monitoring_values,
)


class StubSettingsReader:
    def __init__(self, values: dict[str, str]):
        self.values = values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


@pytest.mark.asyncio
async def test_manager_http_error_monitoring_defaults_to_disabled() -> None:
    settings = await read_manager_http_error_monitoring_values(StubSettingsReader({}))

    assert settings.enabled is False
    assert settings.window_minutes == 15
    assert settings.not_found_threshold == 20
    assert settings.server_error_threshold == 1
    assert settings.excluded_paths == ()


@pytest.mark.asyncio
async def test_manager_http_error_monitoring_normalizes_stored_values() -> None:
    settings = await read_manager_http_error_monitoring_values(
        StubSettingsReader(
            {
                "manager_http_error_monitoring_enabled": "true",
                "manager_http_error_window_minutes": "999",
                "manager_http_not_found_threshold": "0",
                "manager_http_server_error_threshold": "invalid",
                "manager_http_excluded_paths": "/api/v1/health/\n/api/v1/health\n/api/v1/auth/me",
            }
        )
    )

    assert settings.enabled is True
    assert settings.window_minutes == 60
    assert settings.not_found_threshold == 1
    assert settings.server_error_threshold == 1
    assert settings.excluded_paths == ("/api/v1/health", "/api/v1/auth/me")


@pytest.mark.asyncio
async def test_manager_http_error_monitor_status_uses_saved_check() -> None:
    status = await read_manager_http_error_monitor_status(
        StubSettingsReader(
            {
                "manager_http_error_monitoring_enabled": "true",
                "manager_http_error_window_minutes": "30",
                "manager_http_not_found_threshold": "50",
                "manager_http_server_error_threshold": "3",
                "manager_http_excluded_paths": "/api/v1/health",
                "manager_http_error_alert_state": json.dumps(
                    {
                        "available": True,
                        "alert_active": True,
                        "checked_at": "2026-07-14T18:00:00+00:00",
                        "last_alert_at": "2026-07-14T17:59:00+00:00",
                        "not_found_count": 51,
                        "server_error_count": 2,
                    }
                ),
            }
        )
    )

    assert status == {
        "enabled": True,
        "available": True,
        "checked_at": "2026-07-14T18:00:00+00:00",
        "last_alert_at": "2026-07-14T17:59:00+00:00",
        "breached": True,
        "window_minutes": 30,
        "not_found_count": 51,
        "not_found_threshold": 50,
        "server_error_count": 2,
        "server_error_threshold": 3,
        "excluded_paths": ["/api/v1/health"],
    }


def test_manager_http_excluded_paths_rejects_whole_api_and_query() -> None:
    with pytest.raises(ValueError):
        normalize_manager_http_excluded_paths(["/api/"])
    with pytest.raises(ValueError):
        normalize_manager_http_excluded_paths(["/api/v1/health?deep=true"])

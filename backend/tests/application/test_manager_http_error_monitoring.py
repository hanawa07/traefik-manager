import pytest

from app.application.manager_http_error_monitoring import (
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


@pytest.mark.asyncio
async def test_manager_http_error_monitoring_normalizes_stored_values() -> None:
    settings = await read_manager_http_error_monitoring_values(
        StubSettingsReader(
            {
                "manager_http_error_monitoring_enabled": "true",
                "manager_http_error_window_minutes": "999",
                "manager_http_not_found_threshold": "0",
                "manager_http_server_error_threshold": "invalid",
            }
        )
    )

    assert settings.enabled is True
    assert settings.window_minutes == 60
    assert settings.not_found_threshold == 1
    assert settings.server_error_threshold == 1

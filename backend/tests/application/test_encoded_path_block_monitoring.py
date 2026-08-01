import json

import pytest

from app.application.encoded_path_block_monitoring import (
    read_encoded_path_block_monitor_status,
    read_encoded_path_block_monitoring_values,
)


class StubSettingsReader:
    def __init__(self, values: dict[str, str]):
        self.values = values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


@pytest.mark.asyncio
async def test_encoded_path_block_monitoring_defaults_enabled() -> None:
    settings = await read_encoded_path_block_monitoring_values(StubSettingsReader({}))

    assert settings.enabled is True
    assert settings.window_minutes == 15
    assert settings.threshold == 20


@pytest.mark.asyncio
async def test_encoded_path_block_monitoring_normalizes_stored_values() -> None:
    settings = await read_encoded_path_block_monitoring_values(
        StubSettingsReader(
            {
                "traefik_encoded_path_block_monitoring_enabled": "false",
                "traefik_encoded_path_block_window_minutes": "9999",
                "traefik_encoded_path_block_threshold": "invalid",
            }
        )
    )

    assert settings.enabled is False
    assert settings.window_minutes == 1440
    assert settings.threshold == 20


@pytest.mark.asyncio
async def test_encoded_path_block_monitor_status_reads_private_count_state() -> None:
    status = await read_encoded_path_block_monitor_status(
        StubSettingsReader(
            {
                "traefik_encoded_path_block_window_minutes": "30",
                "traefik_encoded_path_block_threshold": "50",
                "traefik_encoded_path_block_alert_state": json.dumps(
                    {
                        "alert_active": True,
                        "last_alert_at": "2026-08-01T23:59:00+00:00",
                        "blocked_request_count": 51,
                    }
                ),
            }
        )
    )

    assert status == {
        "alert_monitoring_enabled": True,
        "alert_active": True,
        "alert_window_minutes": 30,
        "alert_threshold": 50,
        "recent_blocked_request_count": 51,
    }

import pytest

from app.application.manager_health_monitoring import (
    read_manager_health_monitoring_values,
)


class StubSettingsReader:
    def __init__(self, values: dict[str, str]):
        self.values = values

    async def get(self, key: str) -> str | None:
        return self.values.get(key)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("stored_value", "expected"),
    [
        (None, 60),
        ("invalid", 60),
        ("1", 5),
        ("15", 15),
        ("9999", 1440),
    ],
)
async def test_load_manager_health_monitoring_settings_normalizes_cooldown(
    stored_value,
    expected,
):
    values = {}
    if stored_value is not None:
        values["manager_health_alert_cooldown_minutes"] = stored_value

    _, cooldown_minutes = await read_manager_health_monitoring_values(
        StubSettingsReader(values)
    )

    assert cooldown_minutes == expected


@pytest.mark.asyncio
async def test_load_manager_health_monitoring_settings_reads_disabled_state():
    enabled, _ = await read_manager_health_monitoring_values(
        StubSettingsReader({"manager_health_monitoring_enabled": "false"})
    )

    assert enabled is False

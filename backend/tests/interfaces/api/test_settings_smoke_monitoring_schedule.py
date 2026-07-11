from datetime import datetime, timezone

from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    should_run_scheduled_smoke,
)


def test_should_run_scheduled_smoke_respects_enabled_and_frequency() -> None:
    sunday_in_seoul = datetime(2026, 7, 11, 18, 17, tzinfo=timezone.utc)
    saturday_in_seoul = datetime(2026, 7, 10, 18, 17, tzinfo=timezone.utc)

    assert should_run_scheduled_smoke(
        {"monitoring_enabled": True, "monitoring_frequency": "daily"},
        now=saturday_in_seoul,
    )
    assert should_run_scheduled_smoke(
        {"monitoring_enabled": True, "monitoring_frequency": "weekly"},
        now=sunday_in_seoul,
    )
    assert not should_run_scheduled_smoke(
        {"monitoring_enabled": True, "monitoring_frequency": "weekly"},
        now=saturday_in_seoul,
    )
    assert not should_run_scheduled_smoke(
        {"monitoring_enabled": False, "monitoring_frequency": "daily"},
        now=sunday_in_seoul,
    )

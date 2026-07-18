from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.interfaces.api.v1.routers.settings_value_helpers import get_bool_setting, get_int_setting

SMOKE_MONITORING_ENABLED_KEY = "dashboard_smoke_monitoring_enabled"
SMOKE_MONITORING_FREQUENCY_KEY = "dashboard_smoke_monitoring_frequency"
SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_KEY = "dashboard_smoke_failure_rate_threshold_percent"
SMOKE_FAILURE_RATE_MIN_RUNS_KEY = "dashboard_smoke_failure_rate_min_runs"
SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_DEFAULT = 30
SMOKE_FAILURE_RATE_MIN_RUNS_DEFAULT = 3
SMOKE_MONITORING_FREQUENCIES = {"daily", "weekly"}
SMOKE_MONITORING_SCHEDULE_TIME = "03:17"
SMOKE_MONITORING_SCHEDULE_TIMEZONE = "Asia/Seoul"


async def read_smoke_monitoring_values(repo: Any) -> dict[str, Any]:
    frequency = ((await repo.get(SMOKE_MONITORING_FREQUENCY_KEY)) or "daily").strip().lower()
    if frequency not in SMOKE_MONITORING_FREQUENCIES:
        frequency = "daily"
    failure_rate_threshold = await get_int_setting(
        repo,
        SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_KEY,
        default=SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_DEFAULT,
    )
    if not 1 <= failure_rate_threshold <= 100:
        failure_rate_threshold = SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_DEFAULT
    failure_rate_min_runs = await get_int_setting(
        repo,
        SMOKE_FAILURE_RATE_MIN_RUNS_KEY,
        default=SMOKE_FAILURE_RATE_MIN_RUNS_DEFAULT,
    )
    if not 1 <= failure_rate_min_runs <= 30:
        failure_rate_min_runs = SMOKE_FAILURE_RATE_MIN_RUNS_DEFAULT
    return {
        "monitoring_enabled": await get_bool_setting(
            repo,
            SMOKE_MONITORING_ENABLED_KEY,
            default=True,
        ),
        "monitoring_frequency": frequency,
        "monitoring_failure_rate_threshold_percent": failure_rate_threshold,
        "monitoring_failure_rate_min_runs": failure_rate_min_runs,
        "monitoring_schedule_time": SMOKE_MONITORING_SCHEDULE_TIME,
        "monitoring_schedule_timezone": SMOKE_MONITORING_SCHEDULE_TIMEZONE,
    }


async def update_smoke_monitoring_values(
    repo: Any,
    *,
    enabled: bool,
    frequency: str,
    failure_rate_threshold_percent: int,
    failure_rate_min_runs: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    before = await read_smoke_monitoring_values(repo)
    await repo.set(SMOKE_MONITORING_ENABLED_KEY, "true" if enabled else "false")
    await repo.set(SMOKE_MONITORING_FREQUENCY_KEY, frequency)
    await repo.set(SMOKE_FAILURE_RATE_THRESHOLD_PERCENT_KEY, str(failure_rate_threshold_percent))
    await repo.set(SMOKE_FAILURE_RATE_MIN_RUNS_KEY, str(failure_rate_min_runs))
    after = await read_smoke_monitoring_values(repo)
    return before, after


def should_run_scheduled_smoke(
    monitoring: dict[str, Any],
    *,
    now: datetime | None = None,
) -> bool:
    if not monitoring["monitoring_enabled"]:
        return False
    if monitoring["monitoring_frequency"] == "daily":
        return True
    timezone = ZoneInfo(SMOKE_MONITORING_SCHEDULE_TIMEZONE)
    current = now or datetime.now(timezone)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone)
    return current.astimezone(timezone).weekday() == 6

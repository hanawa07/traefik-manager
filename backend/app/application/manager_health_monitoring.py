from typing import Any


MANAGER_HEALTH_MONITORING_ENABLED_KEY = "manager_health_monitoring_enabled"
MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES_KEY = "manager_health_alert_cooldown_minutes"
EXTERNAL_WATCHDOG_STALE_MINUTES_KEY = "external_watchdog_stale_minutes"
DEFAULT_MANAGER_HEALTH_MONITORING_ENABLED = True
DEFAULT_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 60
DEFAULT_EXTERNAL_WATCHDOG_STALE_MINUTES = 10
MIN_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 5
MAX_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 1440
MIN_EXTERNAL_WATCHDOG_STALE_MINUTES = 5
MAX_EXTERNAL_WATCHDOG_STALE_MINUTES = 1440


async def read_manager_health_monitoring_values(repo: Any) -> tuple[bool, int]:
    enabled_value = await repo.get(MANAGER_HEALTH_MONITORING_ENABLED_KEY)
    cooldown_value = await repo.get(MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES_KEY)

    enabled = DEFAULT_MANAGER_HEALTH_MONITORING_ENABLED
    if enabled_value is not None:
        enabled = enabled_value.strip().lower() == "true"

    try:
        cooldown_minutes = int(cooldown_value) if cooldown_value is not None else None
    except ValueError:
        cooldown_minutes = None
    if cooldown_minutes is None:
        cooldown_minutes = DEFAULT_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES
    cooldown_minutes = max(
        MIN_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES,
        min(MAX_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES, cooldown_minutes),
    )

    return enabled, cooldown_minutes


async def read_external_watchdog_stale_minutes(repo: Any) -> int:
    value = await repo.get(EXTERNAL_WATCHDOG_STALE_MINUTES_KEY)
    try:
        minutes = int(value) if value is not None else DEFAULT_EXTERNAL_WATCHDOG_STALE_MINUTES
    except ValueError:
        minutes = DEFAULT_EXTERNAL_WATCHDOG_STALE_MINUTES
    return max(
        MIN_EXTERNAL_WATCHDOG_STALE_MINUTES,
        min(MAX_EXTERNAL_WATCHDOG_STALE_MINUTES, minutes),
    )

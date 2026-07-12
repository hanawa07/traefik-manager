from typing import Any


MANAGER_HEALTH_MONITORING_ENABLED_KEY = "manager_health_monitoring_enabled"
MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES_KEY = "manager_health_alert_cooldown_minutes"
DEFAULT_MANAGER_HEALTH_MONITORING_ENABLED = True
DEFAULT_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 60
MIN_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 5
MAX_MANAGER_HEALTH_ALERT_COOLDOWN_MINUTES = 1440


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

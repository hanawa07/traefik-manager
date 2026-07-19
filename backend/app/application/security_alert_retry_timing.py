from typing import Any


AUTOMATIC_RETRY_DELAY_WARNING_MINUTES_KEY = (
    "security_alert_automatic_retry_delay_warning_minutes"
)
DEFAULT_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES = 10
MIN_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES = 5
MAX_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES = 1440


async def read_automatic_retry_delay_warning_minutes(repo: Any) -> int:
    value = await repo.get(AUTOMATIC_RETRY_DELAY_WARNING_MINUTES_KEY)
    try:
        minutes = int(value) if value is not None else DEFAULT_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES
    except ValueError:
        minutes = DEFAULT_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES
    return max(
        MIN_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES,
        min(MAX_AUTOMATIC_RETRY_DELAY_WARNING_MINUTES, minutes),
    )

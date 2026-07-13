from dataclasses import dataclass
from typing import Any

MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY = "manager_http_error_monitoring_enabled"
MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY = "manager_http_error_window_minutes"
MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY = "manager_http_not_found_threshold"
MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY = "manager_http_server_error_threshold"

DEFAULT_MANAGER_HTTP_ERROR_MONITORING_ENABLED = False
DEFAULT_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 15
DEFAULT_MANAGER_HTTP_NOT_FOUND_THRESHOLD = 20
DEFAULT_MANAGER_HTTP_SERVER_ERROR_THRESHOLD = 1
MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 5
MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 60
MIN_MANAGER_HTTP_ERROR_THRESHOLD = 1
MAX_MANAGER_HTTP_ERROR_THRESHOLD = 10_000


@dataclass(frozen=True)
class ManagerHttpErrorMonitoringSettings:
    enabled: bool
    window_minutes: int
    not_found_threshold: int
    server_error_threshold: int


async def read_manager_http_error_monitoring_values(
    repo: Any,
) -> ManagerHttpErrorMonitoringSettings:
    enabled_value = await repo.get(MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY)
    window_value = await repo.get(MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY)
    not_found_value = await repo.get(MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY)
    server_error_value = await repo.get(MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY)
    return ManagerHttpErrorMonitoringSettings(
        enabled=_parse_enabled(enabled_value),
        window_minutes=_parse_bounded_int(
            window_value,
            default=DEFAULT_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
            minimum=MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
            maximum=MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES,
        ),
        not_found_threshold=_parse_bounded_int(
            not_found_value,
            default=DEFAULT_MANAGER_HTTP_NOT_FOUND_THRESHOLD,
            minimum=MIN_MANAGER_HTTP_ERROR_THRESHOLD,
            maximum=MAX_MANAGER_HTTP_ERROR_THRESHOLD,
        ),
        server_error_threshold=_parse_bounded_int(
            server_error_value,
            default=DEFAULT_MANAGER_HTTP_SERVER_ERROR_THRESHOLD,
            minimum=MIN_MANAGER_HTTP_ERROR_THRESHOLD,
            maximum=MAX_MANAGER_HTTP_ERROR_THRESHOLD,
        ),
    )


def _parse_enabled(value: str | None) -> bool:
    if value is None:
        return DEFAULT_MANAGER_HTTP_ERROR_MONITORING_ENABLED
    return value.strip().lower() == "true"


def _parse_bounded_int(
    value: str | None,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        parsed = default
    return max(minimum, min(maximum, parsed))

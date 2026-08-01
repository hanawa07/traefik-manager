import json
from dataclasses import dataclass
from typing import Any


ENCODED_PATH_BLOCK_MONITORING_ENABLED_KEY = (
    "traefik_encoded_path_block_monitoring_enabled"
)
ENCODED_PATH_BLOCK_WINDOW_MINUTES_KEY = "traefik_encoded_path_block_window_minutes"
ENCODED_PATH_BLOCK_THRESHOLD_KEY = "traefik_encoded_path_block_threshold"
ENCODED_PATH_BLOCK_STATE_KEY = "traefik_encoded_path_block_alert_state"

DEFAULT_ENCODED_PATH_BLOCK_MONITORING_ENABLED = True
DEFAULT_ENCODED_PATH_BLOCK_WINDOW_MINUTES = 15
DEFAULT_ENCODED_PATH_BLOCK_THRESHOLD = 20
MIN_ENCODED_PATH_BLOCK_WINDOW_MINUTES = 5
MAX_ENCODED_PATH_BLOCK_WINDOW_MINUTES = 1440
MIN_ENCODED_PATH_BLOCK_THRESHOLD = 1
MAX_ENCODED_PATH_BLOCK_THRESHOLD = 10_000


@dataclass(frozen=True)
class EncodedPathBlockMonitoringSettings:
    enabled: bool
    window_minutes: int
    threshold: int


async def read_encoded_path_block_monitoring_values(
    repo: Any,
) -> EncodedPathBlockMonitoringSettings:
    enabled_value = await repo.get(ENCODED_PATH_BLOCK_MONITORING_ENABLED_KEY)
    window_value = await repo.get(ENCODED_PATH_BLOCK_WINDOW_MINUTES_KEY)
    threshold_value = await repo.get(ENCODED_PATH_BLOCK_THRESHOLD_KEY)
    return EncodedPathBlockMonitoringSettings(
        enabled=(
            DEFAULT_ENCODED_PATH_BLOCK_MONITORING_ENABLED
            if enabled_value is None
            else enabled_value.strip().lower() == "true"
        ),
        window_minutes=_bounded_int(
            window_value,
            default=DEFAULT_ENCODED_PATH_BLOCK_WINDOW_MINUTES,
            minimum=MIN_ENCODED_PATH_BLOCK_WINDOW_MINUTES,
            maximum=MAX_ENCODED_PATH_BLOCK_WINDOW_MINUTES,
        ),
        threshold=_bounded_int(
            threshold_value,
            default=DEFAULT_ENCODED_PATH_BLOCK_THRESHOLD,
            minimum=MIN_ENCODED_PATH_BLOCK_THRESHOLD,
            maximum=MAX_ENCODED_PATH_BLOCK_THRESHOLD,
        ),
    )


async def read_encoded_path_block_monitor_status(repo: Any) -> dict[str, object]:
    monitoring = await read_encoded_path_block_monitoring_values(repo)
    state = parse_encoded_path_block_monitor_state(
        await repo.get(ENCODED_PATH_BLOCK_STATE_KEY)
    )
    return {
        "alert_monitoring_enabled": monitoring.enabled,
        "alert_active": monitoring.enabled and bool(state.get("alert_active")),
        "alert_window_minutes": monitoring.window_minutes,
        "alert_threshold": monitoring.threshold,
        "recent_blocked_request_count": _state_count(
            state.get("blocked_request_count")
        ),
    }


def parse_encoded_path_block_monitor_state(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _bounded_int(
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


def _state_count(value: object) -> int:
    return (
        value
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0
        else 0
    )

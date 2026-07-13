import json
from dataclasses import dataclass
from typing import Any

MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY = "manager_http_error_monitoring_enabled"
MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY = "manager_http_error_window_minutes"
MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY = "manager_http_not_found_threshold"
MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY = "manager_http_server_error_threshold"
MANAGER_HTTP_EXCLUDED_PATHS_KEY = "manager_http_excluded_paths"
MANAGER_HTTP_ERROR_STATE_KEY = "manager_http_error_alert_state"

DEFAULT_MANAGER_HTTP_ERROR_MONITORING_ENABLED = False
DEFAULT_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 15
DEFAULT_MANAGER_HTTP_NOT_FOUND_THRESHOLD = 20
DEFAULT_MANAGER_HTTP_SERVER_ERROR_THRESHOLD = 1
MIN_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 5
MAX_MANAGER_HTTP_ERROR_WINDOW_MINUTES = 60
MIN_MANAGER_HTTP_ERROR_THRESHOLD = 1
MAX_MANAGER_HTTP_ERROR_THRESHOLD = 10_000
MAX_MANAGER_HTTP_EXCLUDED_PATHS = 50
MAX_MANAGER_HTTP_EXCLUDED_PATH_LENGTH = 200


@dataclass(frozen=True)
class ManagerHttpErrorMonitoringSettings:
    enabled: bool
    window_minutes: int
    not_found_threshold: int
    server_error_threshold: int
    excluded_paths: tuple[str, ...]


async def read_manager_http_error_monitoring_values(
    repo: Any,
) -> ManagerHttpErrorMonitoringSettings:
    enabled_value = await repo.get(MANAGER_HTTP_ERROR_MONITORING_ENABLED_KEY)
    window_value = await repo.get(MANAGER_HTTP_ERROR_WINDOW_MINUTES_KEY)
    not_found_value = await repo.get(MANAGER_HTTP_NOT_FOUND_THRESHOLD_KEY)
    server_error_value = await repo.get(MANAGER_HTTP_SERVER_ERROR_THRESHOLD_KEY)
    excluded_paths_value = await repo.get(MANAGER_HTTP_EXCLUDED_PATHS_KEY)
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
        excluded_paths=_parse_excluded_paths(excluded_paths_value),
    )


async def read_manager_http_error_monitor_status(repo: Any) -> dict[str, object]:
    monitoring = await read_manager_http_error_monitoring_values(repo)
    state = parse_manager_http_error_state(await repo.get(MANAGER_HTTP_ERROR_STATE_KEY))
    if not monitoring.enabled:
        state = {}
    checked_at = state.get("checked_at") if isinstance(state.get("checked_at"), str) else None
    last_alert_at = (
        state.get("last_alert_at") if isinstance(state.get("last_alert_at"), str) else None
    )
    return {
        "enabled": monitoring.enabled,
        "available": monitoring.enabled
        and bool(state.get("available", checked_at is not None)),
        "checked_at": checked_at if monitoring.enabled else None,
        "last_alert_at": last_alert_at if monitoring.enabled else None,
        "breached": monitoring.enabled and bool(state.get("alert_active")),
        "window_minutes": monitoring.window_minutes,
        "not_found_count": _state_count(state.get("not_found_count")),
        "not_found_threshold": monitoring.not_found_threshold,
        "server_error_count": _state_count(state.get("server_error_count")),
        "server_error_threshold": monitoring.server_error_threshold,
        "excluded_paths": list(monitoring.excluded_paths),
    }


def parse_manager_http_error_state(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def normalize_manager_http_excluded_paths(values: list[str]) -> tuple[str, ...]:
    normalized_paths: list[str] = []
    for value in values:
        path = value.strip()
        if not path:
            continue
        if (
            not path.startswith("/api/")
            or path == "/api/"
            or len(path) > MAX_MANAGER_HTTP_EXCLUDED_PATH_LENGTH
            or any(character.isspace() for character in path)
            or "?" in path
            or "#" in path
        ):
            raise ValueError("제외 경로는 공백·쿼리 없이 /api/로 시작해야 합니다")
        path = path.rstrip("/")
        if path not in normalized_paths:
            normalized_paths.append(path)
    if len(normalized_paths) > MAX_MANAGER_HTTP_EXCLUDED_PATHS:
        raise ValueError(f"제외 경로는 최대 {MAX_MANAGER_HTTP_EXCLUDED_PATHS}개까지 입력할 수 있습니다")
    return tuple(normalized_paths)


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


def _parse_excluded_paths(value: str | None) -> tuple[str, ...]:
    try:
        return normalize_manager_http_excluded_paths((value or "").splitlines())
    except ValueError:
        return ()


def _state_count(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0

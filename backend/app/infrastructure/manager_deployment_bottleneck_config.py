import os
import tempfile
from pathlib import Path

from app.core.config import settings

DEFAULT_THRESHOLD_MS = 60_000
DEFAULT_CONSECUTIVE_COUNT = 3
DEFAULT_EVENT_RETENTION_DAYS = 90
MIN_THRESHOLD_MS = 1_000
MAX_THRESHOLD_MS = 900_000
MIN_CONSECUTIVE_COUNT = 1
MAX_CONSECUTIVE_COUNT = 20
MIN_EVENT_RETENTION_DAYS = 1
MAX_EVENT_RETENTION_DAYS = 3650
MAX_STATE_BYTES = 4 * 1024
CONFIG_SOURCES = {"settings", "environment"}


def read_manager_deployment_bottleneck_config(
    path: str | Path | None = None,
) -> dict[str, int]:
    values = read_bottleneck_pairs(
        Path(path or settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH)
    )
    return {
        "threshold_ms": bounded_int(
            values.get("threshold_ms"),
            default=DEFAULT_THRESHOLD_MS,
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "consecutive_count": bounded_int(
            values.get("consecutive_count"),
            default=DEFAULT_CONSECUTIVE_COUNT,
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
        "event_retention_days": bounded_int(
            values.get("event_retention_days"),
            default=DEFAULT_EVENT_RETENTION_DAYS,
            minimum=MIN_EVENT_RETENTION_DAYS,
            maximum=MAX_EVENT_RETENTION_DAYS,
        ),
    }


def write_manager_deployment_bottleneck_config(
    threshold_ms: int,
    consecutive_count: int,
    event_retention_days: int = DEFAULT_EVENT_RETENTION_DAYS,
    path: str | Path | None = None,
) -> dict[str, int]:
    config_path = Path(path or settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=config_path.parent,
            encoding="utf-8",
            prefix=f".{config_path.name}.",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(
                f"threshold_ms={threshold_ms}\n"
                f"consecutive_count={consecutive_count}\n"
                f"event_retention_days={event_retention_days}\n"
            )
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o644)
        os.replace(temporary_path, config_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return read_manager_deployment_bottleneck_config(config_path)


def read_bottleneck_pairs(path: Path) -> dict[str, str]:
    try:
        if path.stat().st_size > MAX_STATE_BYTES:
            return {}
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        return {}
    return {
        key: value
        for line in lines
        if "=" in line
        for key, value in [line.split("=", 1)]
        if key and "\x00" not in value
    }


def bounded_int(
    value: object,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    try:
        if type(value) is int:
            parsed = value
        elif isinstance(value, str):
            parsed = int(value)
        else:
            return default
    except ValueError:
        return default
    return parsed if minimum <= parsed <= maximum else default


def resolve_config_source(value: str | None, differs: bool) -> str:
    if value in CONFIG_SOURCES:
        return value
    return "environment" if differs else "settings"

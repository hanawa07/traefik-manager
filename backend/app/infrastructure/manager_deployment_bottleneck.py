import os
import tempfile
from datetime import datetime
from pathlib import Path

from app.core.config import settings
from app.infrastructure.github_actions_run import build_actions_run_api_url

DEFAULT_THRESHOLD_MS = 60_000
DEFAULT_CONSECUTIVE_COUNT = 3
MIN_THRESHOLD_MS = 1_000
MAX_THRESHOLD_MS = 900_000
MIN_CONSECUTIVE_COUNT = 1
MAX_CONSECUTIVE_COUNT = 20
MAX_STATE_BYTES = 4 * 1024
ALERT_STATUSES = {"not_checked", "no_history", "normal", "pending", "alerted", "request_failed"}
DEPLOYMENT_STAGES = {
    "prepare",
    "build",
    "migration_preflight",
    "candidate_health",
    "route_switch",
    "leader_handover",
    "public_probe",
    "state_write",
}


def read_manager_deployment_bottleneck_config(
    path: str | Path | None = None,
) -> dict[str, int]:
    values = _read_pairs(Path(path or settings.MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH))
    return {
        "threshold_ms": _bounded_int(
            values.get("threshold_ms"),
            default=DEFAULT_THRESHOLD_MS,
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "consecutive_count": _bounded_int(
            values.get("consecutive_count"),
            default=DEFAULT_CONSECUTIVE_COUNT,
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
    }


def write_manager_deployment_bottleneck_config(
    threshold_ms: int,
    consecutive_count: int,
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
                f"threshold_ms={threshold_ms}\nconsecutive_count={consecutive_count}\n"
            )
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o644)
        os.replace(temporary_path, config_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return read_manager_deployment_bottleneck_config(config_path)


def read_manager_deployment_bottleneck_state(
    status_path: str | Path | None = None,
    config_path: str | Path | None = None,
) -> dict[str, object]:
    config = read_manager_deployment_bottleneck_config(config_path)
    path = Path(status_path or f"{settings.MANAGER_DEPLOYMENT_HISTORY_PATH}.bottleneck-alert.status")
    values = _read_pairs(path)
    status = values.get("status", "not_checked")
    if status not in ALERT_STATUSES:
        status = "not_checked"
    run_url = values.get("run_url") or None
    if run_url and not build_actions_run_api_url(run_url):
        run_url = None
    slowest_stage = values.get("slowest_stage") or None
    if slowest_stage not in DEPLOYMENT_STAGES:
        slowest_stage = None
    return {
        "status": status,
        "configured_threshold_ms": config["threshold_ms"],
        "configured_consecutive_count": config["consecutive_count"],
        "effective_threshold_ms": _bounded_int(
            values.get("effective_threshold_ms"),
            default=config["threshold_ms"],
            minimum=MIN_THRESHOLD_MS,
            maximum=MAX_THRESHOLD_MS,
        ),
        "effective_consecutive_count": _bounded_int(
            values.get("effective_consecutive_count"),
            default=config["consecutive_count"],
            minimum=MIN_CONSECUTIVE_COUNT,
            maximum=MAX_CONSECUTIVE_COUNT,
        ),
        "current_consecutive_count": _bounded_int(
            values.get("current_consecutive_count"),
            default=0,
            minimum=0,
            maximum=10_000,
        ),
        "checked_at": _iso_datetime(values.get("checked_at")),
        "latest_version": (values.get("latest_version") or None),
        "slowest_stage": slowest_stage,
        "slowest_ms": _bounded_int(
            values.get("slowest_ms"),
            default=0,
            minimum=0,
            maximum=24 * 60 * 60 * 1000,
        ),
        "alerted_at": _iso_datetime(values.get("alerted_at")),
        "run_url": run_url,
    }


def _read_pairs(path: Path) -> dict[str, str]:
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


def _bounded_int(value: str | None, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        return default
    return parsed if minimum <= parsed <= maximum else default


def _iso_datetime(value: str | None) -> str | None:
    if not value:
        return None
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value

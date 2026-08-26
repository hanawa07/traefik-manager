import json
import re
from pathlib import Path

from app.infrastructure.traefik_update_history_codec import (
    parse_traefik_update_datetime,
)

MAX_STATE_BYTES = 16 * 1024
RECOVERY_STATUSES = {"rolled_back", "rollback_failed"}
VERSION_PATTERN = re.compile(r"^v\d+\.\d+\.\d+$")


def read_checkpoint_summary(path: str | Path) -> dict[str, object]:
    status, raw = _read_state(Path(path))
    if status != "ready":
        return {"status": status, "saved_at": None, "version": None}
    saved_at = raw.get("saved_at")
    version = raw.get("version")
    if (
        raw.get("schema_version") != 1
        or not isinstance(saved_at, str)
        or parse_traefik_update_datetime(saved_at) is None
        or not isinstance(version, str)
        or VERSION_PATTERN.fullmatch(version) is None
    ):
        return {"status": "invalid", "saved_at": None, "version": None}
    return {"status": "ready", "saved_at": saved_at, "version": version}


def read_recovery_summary(path: str | Path) -> dict[str, object]:
    status, raw = _read_state(Path(path))
    if status == "missing":
        return {"status": "none", "occurred_at": None, "source": None}
    occurred_at = raw.get("occurred_at")
    recovery_status = raw.get("status")
    source = raw.get("source")
    if (
        status != "ready"
        or raw.get("schema_version") != 1
        or recovery_status not in RECOVERY_STATUSES
        or source not in {"patch_update", "manual_safe"}
        or not isinstance(occurred_at, str)
        or parse_traefik_update_datetime(occurred_at) is None
    ):
        return {"status": "invalid", "occurred_at": None, "source": None}
    return {
        "status": recovery_status,
        "occurred_at": occurred_at,
        "source": source,
    }


def select_latest_recovery(
    history: list[dict[str, object]],
    safe_recreate_recovery: dict[str, object],
) -> dict[str, object]:
    if safe_recreate_recovery["status"] == "invalid":
        return safe_recreate_recovery
    candidates = []
    if safe_recreate_recovery["status"] in RECOVERY_STATUSES:
        candidates.append(safe_recreate_recovery)
    candidates.extend(
        {
            "status": entry["status"],
            "occurred_at": entry["completed_at"],
            "source": "patch_update",
        }
        for entry in history
        if entry.get("status") in RECOVERY_STATUSES
        and isinstance(entry.get("completed_at"), str)
        and parse_traefik_update_datetime(str(entry["completed_at"])) is not None
    )
    if not candidates:
        return {"status": "none", "occurred_at": None, "source": None}
    return max(
        candidates,
        key=lambda entry: parse_traefik_update_datetime(str(entry["occurred_at"])),
    )


def _read_state(path: Path) -> tuple[str, dict[str, object]]:
    try:
        stat = path.lstat()
        if path.is_symlink() or not path.is_file() or stat.st_size > MAX_STATE_BYTES:
            return "invalid", {}
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return "missing", {}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return "invalid", {}
    return ("ready", raw) if isinstance(raw, dict) else ("invalid", {})

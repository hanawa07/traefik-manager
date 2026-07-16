import json
import re
from datetime import datetime
from pathlib import Path

from app.core.config import settings

MAX_HISTORY_BYTES = 64 * 1024
MAX_HISTORY_ENTRIES = 20
MAX_HISTORY_LINE_BYTES = 2048
HISTORY_STATUSES = {"success", "failed_before_switch", "rolled_back", "rollback_failed"}
FAILURE_STAGES = {
    "prepare",
    "build",
    "migration_preflight",
    "candidate_health",
    "route_switch",
    "leader_handover",
    "public_probe",
    "state_write",
}
DEPLOYMENT_SLOTS = {"single", "blue", "green"}
ACTIVE_SLOTS = DEPLOYMENT_SLOTS | {"unknown"}
VERSION_PATTERN = re.compile(r"^v\d+\.\d+\.\d+$")
REVISION_PATTERN = re.compile(r"^[0-9a-f]{40}$")


def read_manager_deployment_history(
    path: str | Path | None = None,
    *,
    limit: int = MAX_HISTORY_ENTRIES,
) -> list[dict[str, object]]:
    history_path = Path(path or settings.MANAGER_DEPLOYMENT_HISTORY_PATH)
    try:
        lines = _read_tail(history_path)
    except OSError:
        return []

    entries: list[dict[str, object]] = []
    for line in reversed(lines):
        if not line or len(line.encode("utf-8")) > MAX_HISTORY_LINE_BYTES:
            continue
        try:
            raw = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        entry = _normalize_entry(raw)
        if entry is not None:
            entries.append(entry)
        if len(entries) >= limit:
            break
    return entries


def _read_tail(path: Path) -> list[str]:
    with path.open("rb") as history_file:
        history_file.seek(0, 2)
        start = max(0, history_file.tell() - MAX_HISTORY_BYTES)
        history_file.seek(start)
        if start:
            history_file.readline()
        return history_file.read(MAX_HISTORY_BYTES).decode("utf-8", errors="ignore").splitlines()


def _normalize_entry(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    string_keys = (
        "status",
        "from_slot",
        "to_slot",
        "active_slot",
        "version",
        "revision",
        "started_at",
        "completed_at",
    )
    if any(not isinstance(raw.get(key), str) for key in string_keys):
        return None
    if raw["status"] not in HISTORY_STATUSES:
        return None
    if raw["from_slot"] not in DEPLOYMENT_SLOTS or raw["to_slot"] not in DEPLOYMENT_SLOTS:
        return None
    if raw["active_slot"] not in ACTIVE_SLOTS:
        return None
    if not VERSION_PATTERN.fullmatch(raw["version"]):
        return None
    if not REVISION_PATTERN.fullmatch(raw["revision"]):
        return None
    if not _is_iso_datetime(raw["started_at"]) or not _is_iso_datetime(raw["completed_at"]):
        return None

    probe_total = raw.get("probe_total")
    probe_failures = raw.get("probe_failures")
    if type(probe_total) is not int or type(probe_failures) is not int:
        return None
    if probe_total < 0 or probe_failures < 0 or probe_failures > probe_total:
        return None
    failure_stage = raw.get("failure_stage") or None
    failure_reason = raw.get("failure_reason") or None
    if failure_stage is not None and failure_stage not in FAILURE_STAGES:
        return None
    if failure_reason is not None and (
        not isinstance(failure_reason, str) or len(failure_reason) > 300
    ):
        return None
    return {
        **{key: raw[key] for key in (*string_keys, "probe_total", "probe_failures")},
        "failure_stage": failure_stage,
        "failure_reason": failure_reason,
    }


def _is_iso_datetime(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True

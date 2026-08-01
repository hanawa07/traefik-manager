import json
import re
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path

from app.infrastructure.github_actions_run import build_actions_run_api_url

MAX_HISTORY_LINE_BYTES = 2048
MAX_STAGE_DURATION_MS = 24 * 60 * 60 * 1000
HISTORY_STATUSES = {"success", "failed_before_switch", "rolled_back", "rollback_failed"}
ALERT_REQUEST_STATUSES = {"not_needed", "requested", "request_failed"}
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


def read_history_lines(path: Path, max_bytes: int) -> list[str]:
    with path.open("rb") as history_file:
        history_file.seek(0, 2)
        start = max(0, history_file.tell() - max_bytes)
        history_file.seek(start)
        if start:
            history_file.readline()
        return history_file.read(max_bytes).decode("utf-8", errors="ignore").splitlines()


def normalize_history_lines(
    lines: Iterable[str],
    limit: int,
) -> list[dict[str, object]]:
    if limit <= 0:
        return []
    entries: list[dict[str, object]] = []
    for line in lines:
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


def completed_at_timestamp(entry: dict[str, object]) -> float:
    completed_at = datetime.fromisoformat(
        str(entry["completed_at"]).replace("Z", "+00:00")
    )
    return completed_at.timestamp()


def completed_at_day(entry: dict[str, object]) -> str:
    return str(entry["completed_at"])[:10]


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
    if (
        raw["from_slot"] not in DEPLOYMENT_SLOTS
        or raw["to_slot"] not in DEPLOYMENT_SLOTS
    ):
        return None
    if raw["active_slot"] not in ACTIVE_SLOTS:
        return None
    if not VERSION_PATTERN.fullmatch(raw["version"]):
        return None
    if not REVISION_PATTERN.fullmatch(raw["revision"]):
        return None
    if not _is_iso_datetime(raw["started_at"]) or not _is_iso_datetime(
        raw["completed_at"]
    ):
        return None

    probe_total = raw.get("probe_total")
    probe_failures = raw.get("probe_failures")
    if type(probe_total) is not int or type(probe_failures) is not int:
        return None
    if probe_total < 0 or probe_failures < 0 or probe_failures > probe_total:
        return None
    failure_stage = raw.get("failure_stage") or None
    failure_reason = raw.get("failure_reason") or None
    if failure_stage is not None and (
        not isinstance(failure_stage, str) or failure_stage not in FAILURE_STAGES
    ):
        return None
    if failure_reason is not None and (
        not isinstance(failure_reason, str) or len(failure_reason) > 300
    ):
        return None
    alert_request_status = raw.get("alert_request_status", "not_needed")
    if not isinstance(alert_request_status, str) or (
        alert_request_status not in ALERT_REQUEST_STATUSES
    ):
        return None
    raw_alert_run_url = raw.get("alert_run_url")
    if raw_alert_run_url in (None, ""):
        alert_run_url = None
    elif isinstance(raw_alert_run_url, str) and build_actions_run_api_url(
        raw_alert_run_url
    ):
        alert_run_url = raw_alert_run_url
    else:
        return None
    if raw["status"] != "rollback_failed" and alert_request_status != "not_needed":
        return None
    if alert_request_status != "requested" and alert_run_url is not None:
        return None
    stage_durations_ms = _normalize_stage_durations(raw.get("stage_durations_ms"))
    return {
        **{key: raw[key] for key in (*string_keys, "probe_total", "probe_failures")},
        "failure_stage": failure_stage,
        "failure_reason": failure_reason,
        "alert_request_status": alert_request_status,
        "alert_run_url": alert_run_url,
        "stage_durations_ms": stage_durations_ms,
    }


def _normalize_stage_durations(raw: object) -> dict[str, int]:
    if not isinstance(raw, dict):
        return {}
    return {
        stage: duration
        for stage, duration in raw.items()
        if stage in FAILURE_STAGES
        and type(duration) is int
        and 0 <= duration <= MAX_STAGE_DURATION_MS
    }


def _is_iso_datetime(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True

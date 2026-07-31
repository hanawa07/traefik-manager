import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.infrastructure.traefik_update_history_codec import (
    normalize_traefik_update_alert_result as _normalize_alert_result,
    normalize_traefik_update_history_entry as _normalize_history_entry,
    parse_traefik_update_datetime as _parse_datetime,
)
from app.infrastructure.traefik_update_requests import REQUEST_FILENAME

MAX_HISTORY_BYTES = 128 * 1024
MAX_HISTORY_ENTRIES = 20
MAX_HISTORY_LINE_BYTES = 4096
RUNNER_HEARTBEAT_MAX_AGE_SECONDS = 180
RUNNER_STATUSES = {"ready", "running", "error"}


def read_traefik_update_operations(
    *,
    history_path: str | Path | None = None,
    request_dir: str | Path | None = None,
    runner_status_path: str | Path | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    directory = Path(request_dir or settings.TRAEFIK_UPDATE_REQUEST_DIR)
    return {
        "runner": _read_runner_status(
            Path(runner_status_path or settings.TRAEFIK_UPDATE_RUNNER_STATUS_PATH),
            now=now or datetime.now(timezone.utc),
        ),
        "pending_request": (directory / REQUEST_FILENAME).is_file(),
        "history": read_traefik_update_history(history_path),
    }


def read_traefik_update_history(
    path: str | Path | None = None,
    *,
    limit: int = MAX_HISTORY_ENTRIES,
) -> list[dict[str, object]]:
    if limit <= 0:
        return []
    history_path = Path(path or settings.TRAEFIK_UPDATE_HISTORY_PATH)
    try:
        lines = _read_tail(history_path)
    except OSError:
        return []

    entries: list[dict[str, object]] = []
    seen_request_ids: set[str] = set()
    for line in reversed(lines):
        if not line or len(line.encode("utf-8")) > MAX_HISTORY_LINE_BYTES:
            continue
        try:
            raw = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        entry = _normalize_history_entry(raw)
        if entry is None or entry["request_id"] in seen_request_ids:
            continue
        seen_request_ids.add(str(entry["request_id"]))
        entries.append(entry)
        if len(entries) >= limit:
            break
    return entries


def _read_runner_status(path: Path, *, now: datetime) -> dict[str, object]:
    fallback = {
        "available": False,
        "status": "unavailable",
        "checked_at": None,
        "message": "호스트 업데이트 실행기 상태를 확인할 수 없습니다",
    }
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return fallback
    if not isinstance(raw, dict):
        return fallback
    status = raw.get("status")
    checked_at = raw.get("checked_at")
    message = raw.get("message")
    if (
        status not in RUNNER_STATUSES
        or not isinstance(checked_at, str)
        or not isinstance(message, str)
        or len(message) > 300
    ):
        return fallback
    parsed_checked_at = _parse_datetime(checked_at)
    if parsed_checked_at is None:
        return fallback
    age_seconds = (now.astimezone(timezone.utc) - parsed_checked_at).total_seconds()
    available = status in {"ready", "running"} and -60 <= age_seconds <= RUNNER_HEARTBEAT_MAX_AGE_SECONDS
    return {
        "available": available,
        "status": status if available or status == "error" else "stale",
        "checked_at": checked_at,
        "message": message if available or status == "error" else "호스트 업데이트 실행기 응답이 오래되었습니다",
    }


def _read_tail(path: Path) -> list[str]:
    with path.open("rb") as history_file:
        history_file.seek(0, 2)
        start = max(0, history_file.tell() - MAX_HISTORY_BYTES)
        history_file.seek(start)
        if start:
            history_file.readline()
        return history_file.read(MAX_HISTORY_BYTES).decode("utf-8", errors="ignore").splitlines()

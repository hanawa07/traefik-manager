import json
import re
from pathlib import Path
from uuid import UUID

from app.core.config import settings
from app.infrastructure.traefik_update_history_codec import (
    parse_traefik_update_datetime,
)

MAX_HISTORY_BYTES = 128 * 1024
MAX_HISTORY_ENTRIES = 20
MAX_HISTORY_LINE_BYTES = 4096
CONTAINER_ID_PATTERN = re.compile(r"^[0-9a-f]{64}$")
RECREATE_STATUSES = {"managed", "unmanaged"}
RECREATE_SOURCES = {"patch_update", "rollback", "manual_safe", "direct_or_unknown"}


def read_traefik_recreation_history(
    path: str | Path | None = None,
    *,
    limit: int = MAX_HISTORY_ENTRIES,
) -> list[dict[str, object]]:
    if limit <= 0:
        return []
    history_path = Path(path or settings.TRAEFIK_RECREATE_HISTORY_PATH)
    try:
        lines = _read_tail(history_path)
    except OSError:
        return []

    entries: list[dict[str, object]] = []
    seen_container_ids: set[str] = set()
    for line in reversed(lines):
        if not line or len(line.encode("utf-8")) > MAX_HISTORY_LINE_BYTES:
            continue
        try:
            raw = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        entry = _normalize_entry(raw)
        if entry is None or str(entry["container_id"]) in seen_container_ids:
            continue
        seen_container_ids.add(str(entry["container_id"]))
        entries.append(entry)
        if len(entries) >= limit:
            break
    return entries


def _normalize_entry(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict) or raw.get("schema_version") != 1:
        return None
    container_id = raw.get("container_id")
    previous_container_id = raw.get("previous_container_id")
    created_at = raw.get("created_at")
    observed_at = raw.get("observed_at")
    image = raw.get("image")
    status = raw.get("status")
    source = raw.get("source")
    request_id = raw.get("request_id")
    actor = raw.get("actor")
    if (
        not _is_container_id(container_id)
        or (previous_container_id is not None and not _is_container_id(previous_container_id))
        or not isinstance(created_at, str)
        or parse_traefik_update_datetime(created_at) is None
        or not isinstance(observed_at, str)
        or parse_traefik_update_datetime(observed_at) is None
        or not isinstance(image, str)
        or not image
        or len(image) > 200
        or any(ord(character) < 32 for character in image)
        or status not in RECREATE_STATUSES
        or source not in RECREATE_SOURCES
        or (status == "unmanaged") != (source == "direct_or_unknown")
        or (request_id is not None and not _is_uuid(request_id))
        or not _is_actor(actor)
    ):
        return None
    return {
        "container_id": container_id,
        "previous_container_id": previous_container_id,
        "created_at": created_at,
        "observed_at": observed_at,
        "image": image,
        "status": status,
        "source": source,
        "request_id": request_id,
        "actor": actor,
    }


def _is_container_id(value: object) -> bool:
    return isinstance(value, str) and CONTAINER_ID_PATTERN.fullmatch(value) is not None


def _is_uuid(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return str(UUID(value)) == value
    except ValueError:
        return False


def _is_actor(value: object) -> bool:
    return value is None or (
        isinstance(value, str)
        and bool(value)
        and len(value) <= 100
        and not any(ord(character) < 32 for character in value)
    )


def _read_tail(path: Path) -> list[str]:
    with path.open("rb") as history_file:
        history_file.seek(0, 2)
        start = max(0, history_file.tell() - MAX_HISTORY_BYTES)
        history_file.seek(start)
        if start:
            history_file.readline()
        return history_file.read(MAX_HISTORY_BYTES).decode("utf-8", errors="ignore").splitlines()

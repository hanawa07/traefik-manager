import fcntl
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.infrastructure.traefik.acme_datetime import parse_datetime
from app.infrastructure.traefik.docker_api import read_docker_container_logs_text
from app.infrastructure.traefik.encoded_path_block_history_state import (
    build_summary,
    count_recent_blocks,
    merge_log_events,
    prune_minutes,
    unavailable_summary,
)

logger = logging.getLogger(__name__)

MAX_HISTORY_BYTES = 1024 * 1024


async def collect_encoded_path_block_history(
    *,
    checked_at: datetime | None = None,
    path: str | Path | None = None,
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    history_path = Path(path or settings.TRAEFIK_ENCODED_PATH_BLOCK_HISTORY_PATH)
    try:
        since = read_encoded_path_block_log_since(history_path)
    except (OSError, TypeError, UnicodeError, ValueError):
        logger.warning("Traefik 인코딩 경로 로그 cursor 조회 실패", exc_info=True)
        since = None
    raw_text = await read_docker_container_logs_text(since=since)
    try:
        return update_encoded_path_block_history(
            raw_text,
            checked_at=current,
            path=history_path,
            tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
        )
    except (OSError, TypeError, UnicodeError, ValueError):
        logger.warning("Traefik 인코딩 경로 차단 이력 저장 실패", exc_info=True)
        return unavailable_summary(
            current,
            collection_available=raw_text is not None,
            tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
        )


def read_encoded_path_block_log_since(path: str | Path | None = None) -> int | None:
    history_path = Path(path or settings.TRAEFIK_ENCODED_PATH_BLOCK_HISTORY_PATH)
    if not history_path.exists():
        return None

    lock_path = Path(f"{history_path}.lock")
    with lock_path.open("a", encoding="utf-8") as lock_file:
        lock_path.chmod(0o600)
        fcntl.flock(lock_file, fcntl.LOCK_SH)
        state = _read_state(history_path)

    cursor_at = parse_datetime(str(state.get("cursor_at") or ""))
    return int(cursor_at.timestamp()) if cursor_at is not None else None


def read_recent_encoded_path_block_count(
    *,
    checked_at: datetime,
    window_minutes: int,
    path: str | Path | None = None,
) -> int | None:
    current = _as_utc(checked_at)
    history_path = Path(path or settings.TRAEFIK_ENCODED_PATH_BLOCK_HISTORY_PATH)
    if not history_path.exists():
        return None

    lock_path = Path(f"{history_path}.lock")
    with lock_path.open("a", encoding="utf-8") as lock_file:
        lock_path.chmod(0o600)
        fcntl.flock(lock_file, fcntl.LOCK_SH)
        state = _read_state(history_path)

    return count_recent_blocks(
        state,
        checked_at=current,
        window_minutes=window_minutes,
    )


def update_encoded_path_block_history(
    raw_text: str | None,
    *,
    checked_at: datetime,
    path: str | Path | None = None,
    tail_lines: int,
) -> dict[str, object]:
    current = _as_utc(checked_at)
    history_path = Path(path or settings.TRAEFIK_ENCODED_PATH_BLOCK_HISTORY_PATH)
    history_path.parent.mkdir(parents=True, exist_ok=True)

    lock_path = Path(f"{history_path}.lock")
    with lock_path.open("a", encoding="utf-8") as lock_file:
        lock_path.chmod(0o600)
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        state_exists = history_path.exists()
        state = _read_state(history_path)
        if raw_text is None and not state_exists:
            return unavailable_summary(
                current,
                collection_available=False,
                tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
            )

        if raw_text is not None:
            merge_log_events(state, raw_text, current)
            state["last_observed_log_lines"] = len(raw_text.splitlines())

        prune_minutes(state, current)
        _write_state(history_path, state)

    return build_summary(
        state,
        checked_at=current,
        collection_available=raw_text is not None,
        tail_lines=tail_lines,
    )


def _read_state(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"minutes": {}, "cursor_fingerprints": []}
    if path.stat().st_size > MAX_HISTORY_BYTES:
        raise ValueError("encoded path block history is too large")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("encoded path block history is invalid")
    return payload


def _write_state(path: Path, state: dict[str, object]) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=path.parent,
            encoding="utf-8",
            prefix=f".{path.name}.",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(state, temporary_file, ensure_ascii=False, separators=(",", ":"))
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        temporary_path.chmod(0o600)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

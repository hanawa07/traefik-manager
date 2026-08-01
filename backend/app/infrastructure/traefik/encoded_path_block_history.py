import fcntl
import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import settings
from app.infrastructure.traefik.acme_datetime import parse_datetime
from app.infrastructure.traefik.docker_api import read_docker_container_logs_text
from app.infrastructure.traefik.encoded_path_blocks import (
    ENCODED_RESERVED_CHARACTERS,
    parse_encoded_path_block_events,
)

logger = logging.getLogger(__name__)

HISTORY_WINDOW_HOURS = 24
MAX_HISTORY_BYTES = 1024 * 1024
MAX_CURSOR_FINGERPRINTS = 100


async def collect_encoded_path_block_history(
    *,
    checked_at: datetime | None = None,
    path: str | Path | None = None,
) -> dict[str, object]:
    current = _as_utc(checked_at or datetime.now(timezone.utc))
    raw_text = await read_docker_container_logs_text()
    try:
        return update_encoded_path_block_history(
            raw_text,
            checked_at=current,
            path=path,
            tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
        )
    except (OSError, TypeError, UnicodeError, ValueError):
        logger.warning("Traefik 인코딩 경로 차단 이력 저장 실패", exc_info=True)
        return _unavailable_summary(current, collection_available=raw_text is not None)


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
            return _unavailable_summary(current, collection_available=False)

        if raw_text is not None:
            _merge_log_events(state, raw_text, current)
            state["last_observed_log_lines"] = len(raw_text.splitlines())

        _prune_minutes(state, current)
        _write_state(history_path, state)

    return _build_summary(
        state,
        checked_at=current,
        collection_available=raw_text is not None,
        tail_lines=tail_lines,
    )


def _merge_log_events(
    state: dict[str, object],
    raw_text: str,
    checked_at: datetime,
) -> None:
    events = parse_encoded_path_block_events(raw_text)
    log_timestamps = [
        occurred_at
        for line in raw_text.splitlines()
        if (occurred_at := parse_datetime(line.split(" ", 1)[0])) is not None
    ]
    cursor_at = parse_datetime(str(state.get("cursor_at") or ""))
    stored_fingerprints = state.get("cursor_fingerprints", [])
    if not isinstance(stored_fingerprints, list):
        stored_fingerprints = []
    cursor_fingerprints = {
        value
        for value in stored_fingerprints
        if isinstance(value, str)
    }
    window_start = checked_at - timedelta(hours=HISTORY_WINDOW_HOURS)

    for event in events:
        occurred_at = event.get("occurred_at")
        fingerprint = event.get("fingerprint")
        if not isinstance(occurred_at, datetime) or not isinstance(fingerprint, str):
            continue
        if occurred_at < window_start or occurred_at > checked_at:
            continue
        if cursor_at is not None and (
            occurred_at < cursor_at
            or (occurred_at == cursor_at and fingerprint in cursor_fingerprints)
        ):
            continue
        _add_event_to_minute(state, event, occurred_at)

    if log_timestamps:
        latest_log_at = max(log_timestamps)
        if cursor_at is None or latest_log_at > cursor_at:
            state["cursor_at"] = latest_log_at.isoformat()
            state["cursor_fingerprints"] = [
                str(event["fingerprint"])
                for event in events
                if event.get("occurred_at") == latest_log_at
            ][:MAX_CURSOR_FINGERPRINTS]
        elif latest_log_at == cursor_at:
            boundary = cursor_fingerprints | {
                str(event["fingerprint"])
                for event in events
                if event.get("occurred_at") == cursor_at
            }
            state["cursor_fingerprints"] = sorted(boundary)[:MAX_CURSOR_FINGERPRINTS]

        earliest_log_at = min(log_timestamps)
        observed_since = parse_datetime(str(state.get("observed_since") or ""))
        state["observed_since"] = min(
            observed_since or earliest_log_at,
            earliest_log_at,
        ).isoformat()
    elif not state.get("observed_since"):
        state["observed_since"] = checked_at.isoformat()


def _add_event_to_minute(
    state: dict[str, object],
    event: dict[str, object],
    occurred_at: datetime,
) -> None:
    minutes = state.setdefault("minutes", {})
    if not isinstance(minutes, dict):
        minutes = {}
        state["minutes"] = minutes
    minute_key = occurred_at.replace(second=0, microsecond=0).isoformat()
    minute = minutes.setdefault(
        minute_key,
        {"blocked_request_count": 0, "encoded_characters": {}, "last_blocked_at": None},
    )
    if not isinstance(minute, dict):
        return

    minute["blocked_request_count"] = int(minute.get("blocked_request_count", 0)) + 1
    encoded_counts = minute.setdefault("encoded_characters", {})
    if isinstance(encoded_counts, dict):
        for encoded in event.get("encoded_characters", []):
            if isinstance(encoded, str):
                encoded_counts[encoded] = int(encoded_counts.get(encoded, 0)) + 1
    previous = parse_datetime(str(minute.get("last_blocked_at") or ""))
    minute["last_blocked_at"] = max(previous or occurred_at, occurred_at).isoformat()


def _prune_minutes(state: dict[str, object], checked_at: datetime) -> None:
    cutoff = checked_at - timedelta(hours=HISTORY_WINDOW_HOURS)
    minutes = state.get("minutes")
    if not isinstance(minutes, dict):
        state["minutes"] = {}
        return
    state["minutes"] = {
        key: value
        for key, value in minutes.items()
        if (started_at := parse_datetime(key)) is not None and started_at >= cutoff
    }


def _build_summary(
    state: dict[str, object],
    *,
    checked_at: datetime,
    collection_available: bool,
    tail_lines: int,
) -> dict[str, object]:
    window_start = checked_at - timedelta(hours=HISTORY_WINDOW_HOURS)
    buckets = [
        {"started_at": window_start + timedelta(hours=index), "blocked_request_count": 0}
        for index in range(HISTORY_WINDOW_HOURS)
    ]
    encoded_counts = {encoded: 0 for encoded, _ in ENCODED_RESERVED_CHARACTERS}
    last_blocked_at: datetime | None = None
    minutes = state.get("minutes") if isinstance(state.get("minutes"), dict) else {}

    for minute_key, minute in minutes.items():
        started_at = parse_datetime(minute_key)
        if started_at is None or started_at < window_start or started_at > checked_at:
            continue
        if not isinstance(minute, dict):
            continue
        bucket_index = min(
            int((started_at - window_start).total_seconds() // 3600),
            HISTORY_WINDOW_HOURS - 1,
        )
        count = int(minute.get("blocked_request_count", 0))
        buckets[bucket_index]["blocked_request_count"] += count
        minute_counts = minute.get("encoded_characters")
        if isinstance(minute_counts, dict):
            for encoded in encoded_counts:
                encoded_counts[encoded] += int(minute_counts.get(encoded, 0))
        occurred_at = parse_datetime(str(minute.get("last_blocked_at") or ""))
        if occurred_at is not None:
            last_blocked_at = max(last_blocked_at or occurred_at, occurred_at)

    blocked_request_count = sum(int(bucket["blocked_request_count"]) for bucket in buckets)
    observed_since = parse_datetime(str(state.get("observed_since") or ""))
    if not collection_available:
        message = "현재 Traefik 로그 연결은 끊겼지만 저장된 최근 24시간 이력을 표시합니다"
    elif blocked_request_count:
        message = f"최근 24시간 동안 인코딩된 예약 문자 경로 {blocked_request_count}건을 차단했습니다"
    else:
        message = "최근 24시간 동안 인코딩된 예약 문자 경로 차단이 없습니다"

    return {
        "available": True,
        "collection_available": collection_available,
        "message": message,
        "checked_at": checked_at,
        "window_hours": HISTORY_WINDOW_HOURS,
        "observed_since": observed_since,
        "sample_coverage_percent": _coverage_percent(checked_at, observed_since),
        "tail_lines": tail_lines,
        "observed_log_lines": int(state.get("last_observed_log_lines", 0)),
        "blocked_request_count": blocked_request_count,
        "last_blocked_at": last_blocked_at,
        "encoded_characters": [
            {
                "encoded": encoded,
                "label": label,
                "request_count": encoded_counts[encoded],
            }
            for encoded, label in ENCODED_RESERVED_CHARACTERS
        ],
        "buckets": buckets,
    }


def _unavailable_summary(
    checked_at: datetime,
    *,
    collection_available: bool,
) -> dict[str, object]:
    summary = _build_summary(
        {},
        checked_at=checked_at,
        collection_available=collection_available,
        tail_lines=settings.TRAEFIK_LOG_TAIL_LINES,
    )
    summary.update(
        available=False,
        message="Traefik 접근 로그의 영속 이력을 읽을 수 없습니다",
    )
    return summary


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


def _coverage_percent(checked_at: datetime, observed_since: datetime | None) -> int:
    if observed_since is None:
        return 0
    elapsed = max(0.0, (checked_at - observed_since).total_seconds())
    return min(100, int(elapsed / timedelta(hours=HISTORY_WINDOW_HOURS).total_seconds() * 100))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

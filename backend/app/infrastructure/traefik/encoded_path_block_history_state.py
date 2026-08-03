from datetime import datetime, timedelta

from app.infrastructure.traefik.acme_datetime import parse_datetime
from app.infrastructure.traefik.encoded_path_blocks import (
    ENCODED_RESERVED_CHARACTERS,
    parse_encoded_path_block_events,
)

HISTORY_WINDOW_HOURS = 24
MAX_CURSOR_FINGERPRINTS = 100


def merge_log_events(
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
        value for value in stored_fingerprints if isinstance(value, str)
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


def prune_minutes(state: dict[str, object], checked_at: datetime) -> None:
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


def count_recent_blocks(
    state: dict[str, object],
    *,
    checked_at: datetime,
    window_minutes: int,
) -> int:
    cutoff = (checked_at - timedelta(minutes=window_minutes)).replace(
        second=0,
        microsecond=0,
    )
    minutes = state.get("minutes")
    if not isinstance(minutes, dict):
        return 0
    return sum(
        int(value.get("blocked_request_count", 0))
        for key, value in minutes.items()
        if isinstance(value, dict)
        and (started_at := parse_datetime(key)) is not None
        and cutoff <= started_at <= checked_at
    )


def build_summary(
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


def unavailable_summary(
    checked_at: datetime,
    *,
    collection_available: bool,
    tail_lines: int,
) -> dict[str, object]:
    summary = build_summary(
        {},
        checked_at=checked_at,
        collection_available=collection_available,
        tail_lines=tail_lines,
    )
    summary.update(
        available=False,
        message="Traefik 접근 로그의 영속 이력을 읽을 수 없습니다",
    )
    return summary


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


def _coverage_percent(checked_at: datetime, observed_since: datetime | None) -> int:
    if observed_since is None:
        return 0
    elapsed = max(0.0, (checked_at - observed_since).total_seconds())
    return min(100, int(elapsed / timedelta(hours=HISTORY_WINDOW_HOURS).total_seconds() * 100))

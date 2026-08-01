import re
from datetime import datetime, timezone

from app.infrastructure.traefik.acme_datetime import parse_datetime


ACCESS_LOG_REQUEST_RE = re.compile(
    r'"[A-Z]+\s+(?P<target>\S+)\s+HTTP/[0-9.]+"\s+(?P<status>[0-9]{3})\b'
)
ENCODED_RESERVED_CHARACTERS = (
    ("%2F", "슬래시 (/)"),
    ("%5C", "백슬래시 (\\)"),
    ("%00", "NUL"),
    ("%3B", "세미콜론 (;)"),
    ("%25", "퍼센트 (%)"),
    ("%3F", "물음표 (?)"),
    ("%23", "해시 (#)"),
)


def build_encoded_path_block_summary(
    raw_text: str | None,
    *,
    tail_lines: int,
    checked_at: datetime | None = None,
) -> dict[str, object]:
    current = checked_at or datetime.now(timezone.utc)
    available = raw_text is not None
    raw_lines = raw_text.splitlines() if raw_text is not None else []
    counts = {encoded: 0 for encoded, _ in ENCODED_RESERVED_CHARACTERS}
    blocked_request_count = 0
    last_blocked_at: datetime | None = None

    for line in raw_lines:
        match = ACCESS_LOG_REQUEST_RE.search(line)
        if match is None or match.group("status") != "400":
            continue

        encoded_path = match.group("target").partition("?")[0].lower()
        matched_encodings = [
            encoded
            for encoded, _ in ENCODED_RESERVED_CHARACTERS
            if encoded.lower() in encoded_path
        ]
        if not matched_encodings:
            continue

        blocked_request_count += 1
        for encoded in matched_encodings:
            counts[encoded] += 1

        occurred_at = parse_datetime(line.split(" ", 1)[0])
        if occurred_at is not None and (
            last_blocked_at is None or occurred_at > last_blocked_at
        ):
            last_blocked_at = occurred_at

    if not available:
        message = "Traefik 접근 로그를 읽을 수 없습니다"
    elif blocked_request_count:
        message = f"최근 Traefik 로그에서 인코딩된 예약 문자 경로 {blocked_request_count}건을 차단했습니다"
    else:
        message = "최근 Traefik 로그에서 인코딩된 예약 문자 경로 차단이 없습니다"

    return {
        "available": available,
        "message": message,
        "checked_at": current,
        "tail_lines": tail_lines,
        "observed_log_lines": len(raw_lines),
        "blocked_request_count": blocked_request_count,
        "last_blocked_at": last_blocked_at,
        "encoded_characters": [
            {
                "encoded": encoded,
                "label": label,
                "request_count": counts[encoded],
            }
            for encoded, label in ENCODED_RESERVED_CHARACTERS
        ],
    }

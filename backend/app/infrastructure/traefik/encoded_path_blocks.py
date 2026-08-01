import hashlib
import re

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


def parse_encoded_path_block_events(raw_text: str | None) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for line in raw_text.splitlines() if raw_text is not None else []:
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

        events.append(
            {
                "fingerprint": hashlib.sha256(line.encode()).hexdigest(),
                "occurred_at": parse_datetime(line.split(" ", 1)[0]),
                "encoded_characters": matched_encodings,
            }
        )
    return events

import hashlib
import re

from app.infrastructure.traefik.acme_datetime import parse_datetime


ACCESS_LOG_REQUEST_RE = re.compile(
    r'"[A-Z]+\s+(?P<target>\S+)\s+HTTP/[0-9.]+"\s+(?P<status>[0-9]{3})\b'
)
ACCESS_LOG_ROUTER_RE = re.compile(
    r'\s+\d+\s+"(?P<router>[^"]*)"\s+"[^"]*"\s+\S+\s*$'
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


def parse_access_log_events(raw_text: str | None) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for line in raw_text.splitlines() if raw_text is not None else []:
        match = ACCESS_LOG_REQUEST_RE.search(line)
        if match is None:
            continue

        matched_encodings: list[str] = []
        if match.group("status") == "400":
            encoded_path = match.group("target").partition("?")[0].lower()
            matched_encodings = [
                encoded
                for encoded, _ in ENCODED_RESERVED_CHARACTERS
                if encoded.lower() in encoded_path
            ]
        router_match = ACCESS_LOG_ROUTER_RE.search(line[match.end():])
        router_name = router_match.group("router") if router_match else None

        events.append(
            {
                "fingerprint": hashlib.sha256(line.encode()).hexdigest(),
                "occurred_at": parse_datetime(line.split(" ", 1)[0]),
                "encoded_characters": matched_encodings,
                "router_name": (
                    router_name if router_name not in {None, "", "-"} else None
                ),
            }
        )
    return events


def parse_encoded_path_block_events(raw_text: str | None) -> list[dict[str, object]]:
    return [
        event
        for event in parse_access_log_events(raw_text)
        if event["encoded_characters"]
    ]

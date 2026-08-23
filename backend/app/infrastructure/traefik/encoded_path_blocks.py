import hashlib
import json
import re
from urllib.parse import urlsplit

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
        json_event = _parse_json_access_log(line)
        if json_event is not None:
            target, status, router_name, request_host_hash = json_event
        else:
            match = ACCESS_LOG_REQUEST_RE.search(line)
            if match is None:
                continue
            target = match.group("target")
            status = match.group("status")
            router_match = ACCESS_LOG_ROUTER_RE.search(line[match.end():])
            router_name = router_match.group("router") if router_match else None
            request_host_hash = None

        matched_encodings: list[str] = []
        if status == "400":
            encoded_path = target.partition("?")[0].lower()
            matched_encodings = [
                encoded
                for encoded, _ in ENCODED_RESERVED_CHARACTERS
                if encoded.lower() in encoded_path
            ]

        events.append(
            {
                "fingerprint": hashlib.sha256(line.encode()).hexdigest(),
                "occurred_at": parse_datetime(line.split(" ", 1)[0]),
                "encoded_characters": matched_encodings,
                "router_name": (
                    router_name if router_name not in {None, "", "-"} else None
                ),
                "request_host_hash": request_host_hash,
            }
        )
    return events


def parse_encoded_path_block_events(raw_text: str | None) -> list[dict[str, object]]:
    return [
        event
        for event in parse_access_log_events(raw_text)
        if event["encoded_characters"]
    ]


def hash_request_host(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        hostname = urlsplit(f"//{value.strip()}").hostname
    except ValueError:
        return None
    if not hostname:
        return None
    normalized = hostname.lower().rstrip(".")
    return hashlib.sha256(normalized.encode()).hexdigest() if normalized else None


def _parse_json_access_log(
    line: str,
) -> tuple[str, str, object, str | None] | None:
    _, separator, payload_text = line.partition(" ")
    if not separator or not payload_text.startswith("{"):
        return None
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    target = payload.get("RequestPath")
    status = payload.get("DownstreamStatus")
    if not isinstance(target, str) or not isinstance(status, int):
        return None
    return (
        target,
        str(status),
        payload.get("RouterName"),
        hash_request_host(payload.get("RequestHost")),
    )

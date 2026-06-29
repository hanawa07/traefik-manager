import re

from app.infrastructure.traefik.acme_datetime import parse_datetime

ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
DOMAIN_RE = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")


def parse_recent_acme_failures(raw_text: str) -> dict[str, dict]:
    failures: dict[str, dict] = {}
    for raw_line in raw_text.splitlines():
        line = ANSI_ESCAPE_RE.sub("", raw_line).strip()
        if not line or "Unable to obtain ACME certificate for domains" not in line:
            continue

        timestamp_raw, message = split_log_timestamp(line)
        occurred_at = parse_datetime(timestamp_raw) if timestamp_raw else None
        error_message = extract_acme_error_message(message)
        error_kind = classify_acme_error(error_message)
        domains = extract_acme_error_domains(message)

        for domain in domains:
            current = failures.get(domain)
            if current is not None and occurred_at and current.get("occurred_at"):
                if current["occurred_at"] >= occurred_at:
                    continue

            failures[domain] = {
                "occurred_at": occurred_at,
                "message": error_message,
                "kind": error_kind,
            }

    return failures


def split_log_timestamp(line: str) -> tuple[str | None, str]:
    if " " not in line:
        return None, line
    first, rest = line.split(" ", 1)
    if parse_datetime(first):
        return first, rest
    return None, line


def extract_acme_error_message(line: str) -> str:
    if "error=" not in line:
        return "최근 ACME 실패 원인을 확인하지 못했습니다"

    message = line.split("error=", 1)[1]
    if " ACME CA=" in message:
        message = message.split(" ACME CA=", 1)[0]

    message = message.strip().strip('"').replace("\\n", " ").strip()
    if "DNS problem:" in message:
        return message[message.index("DNS problem:"):].strip()
    if "rate limit" in message.lower():
        return message[message.lower().index("rate limit"):].strip()
    if "invalid authorization" in message.lower():
        return "invalid authorization"
    if "challenge" in message.lower():
        return message
    return message


def extract_acme_error_domains(line: str) -> list[str]:
    if "domains=" in line:
        domain_segment = line.split("domains=", 1)[1]
        if " providerName=" in domain_segment:
            domain_segment = domain_segment.split(" providerName=", 1)[0]
        domains = DOMAIN_RE.findall(domain_segment)
        if domains:
            return sorted(set(domains))

    return sorted(set(DOMAIN_RE.findall(line)))


def classify_acme_error(message: str) -> str:
    lowered = message.lower()
    if any(marker in lowered for marker in ("dns problem", "looking up a ", "looking up aaaa", "looking up caa")):
        return "dns"
    if "rate limit" in lowered:
        return "rate_limit"
    if "authorization" in lowered or "unauthorized" in lowered:
        return "authorization"
    if "challenge" in lowered:
        return "challenge"
    return "unknown"

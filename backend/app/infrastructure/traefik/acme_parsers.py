import base64
import json
import re
import subprocess
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Callable


ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
DOMAIN_RE = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")


def parse_acme_expiry_map(
    raw_text: str,
    certificate_expiry_extractor: Callable[[str], datetime | None] | None = None,
) -> dict[str, datetime]:
    expiry_map: dict[str, datetime] = {}
    try:
        data = json.loads(raw_text)
    except (TypeError, ValueError):
        return expiry_map

    if not isinstance(data, dict):
        return expiry_map

    extractor = certificate_expiry_extractor or extract_acme_certificate_expiry
    for resolver_data in data.values():
        if not isinstance(resolver_data, dict):
            continue

        for cert_entry in resolver_data.get("Certificates", []):
            if not isinstance(cert_entry, dict):
                continue

            cert_b64 = cert_entry.get("certificate", "")
            domain_info = cert_entry.get("domain", {})
            if not isinstance(domain_info, dict):
                continue

            main = domain_info.get("main", "")
            sans = domain_info.get("sans") or []
            all_domains = [d for d in [main] + sans if isinstance(d, str) and d]
            if not cert_b64 or not all_domains:
                continue

            expires_at = extractor(cert_b64)
            if expires_at is None:
                continue

            for domain in all_domains:
                existing = expiry_map.get(domain)
                if existing is None or expires_at < existing:
                    expiry_map[domain] = expires_at

    return expiry_map


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


def extract_acme_certificate_expiry(cert_b64: str) -> datetime | None:
    try:
        cert_der = base64.b64decode(cert_b64)
        result = subprocess.run(
            ["openssl", "x509", "-noout", "-enddate"],
            input=cert_der,
            capture_output=True,
            timeout=5,
            check=False,
        )
        output = result.stdout.decode().strip()
        if not output.startswith("notAfter="):
            return None

        expires_at = parsedate_to_datetime(output[len("notAfter="):])
        if expires_at is None:
            return None
        if expires_at.tzinfo is None:
            return expires_at.replace(tzinfo=timezone.utc)
        return expires_at.astimezone(timezone.utc)
    except Exception:
        return None


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
    if any(
        marker in lowered
        for marker in ("dns problem", "looking up a ", "looking up aaaa", "looking up caa")
    ):
        return "dns"
    if "rate limit" in lowered:
        return "rate_limit"
    if "authorization" in lowered or "unauthorized" in lowered:
        return "authorization"
    if "challenge" in lowered:
        return "challenge"
    return "unknown"


def extract_expiry_map(payload: dict | list) -> dict[str, datetime]:
    expiry_map: dict[str, datetime] = {}

    def walk(node):
        if isinstance(node, dict):
            domain_candidates = extract_domain_candidates(node)
            expires_at = extract_expiry(node)
            if domain_candidates and expires_at:
                for domain in domain_candidates:
                    existing = expiry_map.get(domain)
                    if existing is None or expires_at < existing:
                        expiry_map[domain] = expires_at
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    return expiry_map


def extract_domain_candidates(node: dict) -> set[str]:
    domains: set[str] = set()

    single_domain = node.get("domain")
    if isinstance(single_domain, str) and single_domain:
        domains.add(single_domain)
    elif isinstance(single_domain, dict):
        main = single_domain.get("main")
        if isinstance(main, str) and main:
            domains.add(main)
        sans = single_domain.get("sans")
        if isinstance(sans, list):
            for san in sans:
                if isinstance(san, str) and san:
                    domains.add(san)

    domain_list = node.get("domains")
    if isinstance(domain_list, list):
        for item in domain_list:
            if isinstance(item, str) and item:
                domains.add(item)
            elif isinstance(item, dict):
                main = item.get("main")
                if isinstance(main, str) and main:
                    domains.add(main)
                sans = item.get("sans")
                if isinstance(sans, list):
                    for san in sans:
                        if isinstance(san, str) and san:
                            domains.add(san)

    return domains


def extract_expiry(node: dict) -> datetime | None:
    for key in ("notAfter", "not_after", "expiresAt", "expires_at", "expiration", "expirationDate", "expiryDate"):
        value = node.get(key)
        parsed = parse_datetime(value)
        if parsed:
            return parsed
    return None


def parse_datetime(value) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None

    raw = value.strip()
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass

    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def find_expiry(domain: str, expiry_map: dict[str, datetime]) -> datetime | None:
    if domain in expiry_map:
        return expiry_map[domain]

    for cert_domain, expires_at in expiry_map.items():
        if cert_domain.startswith("*.") and domain.endswith(cert_domain[1:]):
            return expires_at
    return None


def to_certificate_response(cert: dict) -> dict:
    now = datetime.now(timezone.utc)
    expires_at = cert.get("expires_at")
    cert_resolvers = sorted(cert["cert_resolvers"])

    status = "warning"
    message = "만료일 정보를 확인할 수 없습니다"
    days_remaining = None

    if isinstance(expires_at, datetime):
        days_remaining = int((expires_at - now).total_seconds() // 86400)
        if expires_at < now:
            status = "error"
            message = "인증서가 만료되었습니다"
        elif days_remaining <= 30:
            status = "warning"
            message = f"{days_remaining}일 이내 만료 예정"
        else:
            status = "active"
            message = "정상"
    elif cert_resolvers:
        status = "pending"
        message = "정식 인증서 발급 대기 또는 검증 실패"
    else:
        status = "inactive"
        message = "자동 인증서 발급 미설정"

    return {
        "domain": cert["domain"],
        "router_names": sorted(cert["router_names"]),
        "cert_resolvers": cert_resolvers,
        "expires_at": expires_at,
        "days_remaining": days_remaining,
        "status": status,
        "status_message": message,
        "last_acme_error_at": cert.get("last_acme_error_at"),
        "last_acme_error_message": cert.get("last_acme_error_message"),
        "last_acme_error_kind": cert.get("last_acme_error_kind"),
    }

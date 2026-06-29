import base64
import json
import subprocess
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Callable

from app.infrastructure.traefik.acme_datetime import parse_datetime


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
            all_domains = [domain for domain in [main] + sans if isinstance(domain, str) and domain]
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
        add_domain_entry(domains, single_domain)

    domain_list = node.get("domains")
    if isinstance(domain_list, list):
        for item in domain_list:
            if isinstance(item, str) and item:
                domains.add(item)
            elif isinstance(item, dict):
                add_domain_entry(domains, item)

    return domains


def extract_expiry(node: dict) -> datetime | None:
    for key in ("notAfter", "not_after", "expiresAt", "expires_at", "expiration", "expirationDate", "expiryDate"):
        value = node.get(key)
        parsed = parse_datetime(value)
        if parsed:
            return parsed
    return None


def find_expiry(domain: str, expiry_map: dict[str, datetime]) -> datetime | None:
    if domain in expiry_map:
        return expiry_map[domain]

    for cert_domain, expires_at in expiry_map.items():
        if cert_domain.startswith("*.") and domain.endswith(cert_domain[1:]):
            return expires_at
    return None


def add_domain_entry(domains: set[str], item: dict) -> None:
    main = item.get("main")
    if isinstance(main, str) and main:
        domains.add(main)
    sans = item.get("sans")
    if isinstance(sans, list):
        for san in sans:
            if isinstance(san, str) and san:
                domains.add(san)

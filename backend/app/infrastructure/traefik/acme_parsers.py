from datetime import datetime
from typing import Callable

from app.infrastructure.traefik.acme_datetime import parse_datetime
from app.infrastructure.traefik.acme_expiry_parser import (
    extract_acme_certificate_expiry,
    extract_domain_candidates,
    extract_expiry,
    extract_expiry_map,
    find_expiry,
    parse_acme_expiry_map as _parse_acme_expiry_map,
)
from app.infrastructure.traefik.acme_failure_parser import (
    classify_acme_error,
    extract_acme_error_domains,
    extract_acme_error_message,
    parse_recent_acme_failures,
    split_log_timestamp,
)
from app.infrastructure.traefik.certificate_response_builder import to_certificate_response


def parse_acme_expiry_map(
    raw_text: str,
    certificate_expiry_extractor: Callable[[str], datetime | None] | None = None,
) -> dict[str, datetime]:
    return _parse_acme_expiry_map(
        raw_text,
        certificate_expiry_extractor or extract_acme_certificate_expiry,
    )


__all__ = [
    "classify_acme_error",
    "extract_acme_certificate_expiry",
    "extract_acme_error_domains",
    "extract_acme_error_message",
    "extract_domain_candidates",
    "extract_expiry",
    "extract_expiry_map",
    "find_expiry",
    "parse_acme_expiry_map",
    "parse_datetime",
    "parse_recent_acme_failures",
    "split_log_timestamp",
    "to_certificate_response",
]

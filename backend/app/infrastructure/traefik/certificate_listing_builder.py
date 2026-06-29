from datetime import datetime

from app.infrastructure.traefik.acme_parsers import (
    extract_expiry_map,
    find_expiry,
    to_certificate_response,
)
from app.infrastructure.traefik.runtime_parsers import (
    extract_domains_from_router,
    normalize_routers,
)


def build_certificate_listing(
    *,
    overview: dict | list,
    routers_payload: dict | list,
    recent_acme_failures: dict[str, dict],
    acme_expiry_map: dict[str, datetime],
) -> list[dict]:
    expiry_map = extract_expiry_map(overview)
    for domain, expires_at in acme_expiry_map.items():
        if domain not in expiry_map:
            expiry_map[domain] = expires_at

    certificates_by_domain: dict[str, dict] = {}
    for router in normalize_routers(routers_payload):
        tls_info = router.get("tls")
        if not tls_info:
            continue

        domains = extract_domains_from_router(router)
        if not domains:
            continue

        resolver = tls_info.get("certResolver") if isinstance(tls_info, dict) else None
        router_name = router.get("name") or router.get("service") or "unknown"
        for domain in domains:
            cert = certificates_by_domain.setdefault(
                domain,
                {
                    "domain": domain,
                    "router_names": set(),
                    "cert_resolvers": set(),
                    "expires_at": find_expiry(domain, expiry_map),
                    "last_acme_error_at": None,
                    "last_acme_error_message": None,
                    "last_acme_error_kind": None,
                },
            )
            cert["router_names"].add(router_name)
            if resolver:
                cert["cert_resolvers"].add(str(resolver))
            _attach_recent_acme_failure(cert, recent_acme_failures.get(domain))

    result = [to_certificate_response(cert) for cert in certificates_by_domain.values()]
    return sorted(
        result,
        key=lambda item: (
            item["days_remaining"] is None,
            item["days_remaining"] or 99999,
            item["domain"],
        ),
    )


def _attach_recent_acme_failure(cert: dict, recent_failure: dict | None) -> None:
    if not recent_failure:
        return
    cert["last_acme_error_at"] = recent_failure.get("occurred_at")
    cert["last_acme_error_message"] = recent_failure.get("message")
    cert["last_acme_error_kind"] = recent_failure.get("kind")

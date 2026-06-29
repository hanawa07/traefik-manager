from datetime import datetime, timezone

from app.infrastructure.traefik.certificate_preflight import (
    build_certificate_preflight_items,
    build_preflight_recommendation,
    compute_preflight_overall_status,
)


def build_certificate_preflight_result(
    *,
    domain: str,
    certificates: list[dict],
    dns_result: dict,
    http_result: dict,
    https_result: dict,
) -> dict:
    certificate = next((item for item in certificates if item["domain"] == domain), None)
    items = build_certificate_preflight_items(domain, certificate, dns_result, http_result, https_result)
    overall_status = compute_preflight_overall_status(items)
    recommendation = build_preflight_recommendation(items, certificate)

    return {
        "domain": domain,
        "checked_at": datetime.now(timezone.utc),
        "overall_status": overall_status,
        "recommendation": recommendation,
        "items": items,
    }

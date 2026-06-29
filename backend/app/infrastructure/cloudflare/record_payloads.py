from ipaddress import ip_address

from app.infrastructure.cloudflare.errors import CloudflareClientError
from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig

MANAGED_RECORD_COMMENT = "managed-by-traefik-manager"


def build_service_record_payload(
    domain: str,
    fallback_target: str,
    zone_config: CloudflareZoneConfig | None = None,
) -> dict[str, object]:
    content = ((zone_config.record_target if zone_config else None) or fallback_target).strip()
    if not content:
        raise CloudflareClientError("Cloudflare 레코드 대상 값이 없습니다")

    return {
        "type": detect_record_type(content),
        "name": domain,
        "content": content,
        "ttl": 1,
        "proxied": zone_config.proxied if zone_config else False,
        "comment": MANAGED_RECORD_COMMENT,
    }


def detect_record_type(content: str) -> str:
    try:
        parsed = ip_address(content)
        return "A" if parsed.version == 4 else "AAAA"
    except ValueError:
        return "CNAME"

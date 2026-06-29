import httpx

from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig


def create_cloudflare_http_client(
    *,
    base_url: str,
    timeout: int,
    zone_config: CloudflareZoneConfig,
) -> httpx.AsyncClient:
    headers = {
        "Authorization": f"Bearer {zone_config.api_token}",
        "Content-Type": "application/json",
    }
    return httpx.AsyncClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
    )

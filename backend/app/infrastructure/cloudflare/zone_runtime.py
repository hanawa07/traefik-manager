from collections.abc import Awaitable, Callable

import httpx

from app.infrastructure.cloudflare.errors import CloudflareClientError
from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig

ClientFactory = Callable[[CloudflareZoneConfig], httpx.AsyncClient]
DecodeResponse = Callable[[httpx.Response], Awaitable[dict]]


async def fetch_zone_name(
    *,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
    zone_config: CloudflareZoneConfig | None,
) -> str | None:
    if not zone_config:
        return None

    async with client_factory(zone_config) as client:
        response = await client.get(f"/zones/{zone_config.zone_id}")
        data = await decode_response(response)

    result = data.get("result", {})
    if not isinstance(result, dict):
        return None
    zone_name = result.get("name")
    normalized_zone_name = (
        zone_name.strip().lower() if isinstance(zone_name, str) and zone_name.strip() else None
    )
    zone_config.zone_name = normalized_zone_name
    return normalized_zone_name


async def ensure_zone_names(
    *,
    zone_configs: list[CloudflareZoneConfig],
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
) -> None:
    for config in zone_configs:
        if not config.zone_name:
            await fetch_zone_name(
                client_factory=client_factory,
                decode_response=decode_response,
                zone_config=config,
            )


async def run_zone_connection_test(
    *,
    zone_configs: list[CloudflareZoneConfig],
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
) -> dict:
    if not zone_configs:
        return {
            "success": False,
            "message": "Cloudflare 설정이 비활성화되어 있습니다",
            "detail": "API token과 zone id를 먼저 저장하세요",
        }

    resolved_zone_names: list[str] = []
    failed_details: list[str] = []
    for config in zone_configs:
        try:
            zone_name = await fetch_zone_name(
                client_factory=client_factory,
                decode_response=decode_response,
                zone_config=config,
            )
        except CloudflareClientError as exc:
            failed_details.append(f"{config.zone_id}: {exc}")
            continue
        resolved_zone_names.append(zone_name or config.zone_id)

    if failed_details:
        return {
            "success": False,
            "message": "Cloudflare 연결 테스트에 실패했습니다",
            "detail": "; ".join(failed_details),
        }

    return {
        "success": True,
        "message": "Cloudflare 연결에 성공했습니다",
        "detail": ", ".join(resolved_zone_names) if resolved_zone_names else "설정된 영역에 접근할 수 있습니다",
    }


async def find_matching_zone(
    *,
    zone_configs: list[CloudflareZoneConfig],
    domain: str,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
) -> CloudflareZoneConfig | None:
    if not zone_configs:
        return None
    await ensure_zone_names(
        zone_configs=zone_configs,
        client_factory=client_factory,
        decode_response=decode_response,
    )
    matching_configs = [config for config in zone_configs if config.matches_domain(domain)]
    if not matching_configs:
        return None
    return max(matching_configs, key=lambda item: len(item.zone_name or ""))

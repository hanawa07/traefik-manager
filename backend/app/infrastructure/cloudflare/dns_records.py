from collections.abc import Awaitable, Callable

import httpx

from app.infrastructure.cloudflare.record_payloads import MANAGED_RECORD_COMMENT
from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig

DecodeResponse = Callable[[httpx.Response], Awaitable[dict]]
ClientFactory = Callable[[CloudflareZoneConfig], httpx.AsyncClient]


async def upsert_service_dns_record(
    *,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
    zone_config: CloudflareZoneConfig,
    domain: str,
    payload: dict[str, object],
) -> str:
    async with client_factory(zone_config) as client:
        existing = await find_dns_records(
            client,
            decode_response=decode_response,
            zone_id=zone_config.zone_id,
            domain=domain,
            record_type=str(payload["type"]),
        )
        if existing:
            response = await client.put(
                f"/zones/{zone_config.zone_id}/dns_records/{existing[0]['id']}",
                json=payload,
            )
        else:
            response = await client.post(
                f"/zones/{zone_config.zone_id}/dns_records",
                json=payload,
            )

        data = await decode_response(response)
        return data["result"]["id"]


async def delete_service_dns_record(
    *,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
    zone_config: CloudflareZoneConfig,
    domain: str,
    record_id: str | None,
) -> None:
    async with client_factory(zone_config) as client:
        target_ids: list[str] = []
        if record_id:
            target_ids.append(record_id)
        else:
            records = await find_dns_records(
                client,
                decode_response=decode_response,
                zone_id=zone_config.zone_id,
                domain=domain,
            )
            target_ids.extend(record["id"] for record in records)

        for current_record_id in target_ids:
            response = await client.delete(f"/zones/{zone_config.zone_id}/dns_records/{current_record_id}")
            if response.status_code == 404:
                continue
            await decode_response(response)


async def list_managed_dns_records(
    *,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
    zone_config: CloudflareZoneConfig,
) -> list[dict]:
    all_records = await list_dns_records(
        client_factory=client_factory,
        decode_response=decode_response,
        zone_config=zone_config,
    )
    return [
        item
        for item in all_records
        if isinstance(item, dict) and item.get("comment") == MANAGED_RECORD_COMMENT
    ]


async def list_dns_records(
    *,
    client_factory: ClientFactory,
    decode_response: DecodeResponse,
    zone_config: CloudflareZoneConfig,
) -> list[dict]:
    managed_records: list[dict] = []
    page = 1

    async with client_factory(zone_config) as client:
        while True:
            response = await client.get(
                f"/zones/{zone_config.zone_id}/dns_records",
                params={"per_page": 100, "page": page},
            )
            data = await decode_response(response)
            results = data.get("result", [])
            if isinstance(results, list):
                managed_records.extend(item for item in results if isinstance(item, dict))

            result_info = data.get("result_info", {})
            total_pages = result_info.get("total_pages") if isinstance(result_info, dict) else None
            if not isinstance(total_pages, int) or page >= total_pages:
                break
            page += 1

    return managed_records


async def find_dns_records(
    client: httpx.AsyncClient,
    *,
    decode_response: DecodeResponse,
    zone_id: str,
    domain: str,
    record_type: str | None = None,
) -> list[dict]:
    params = {"name": domain}
    if record_type:
        params["type"] = record_type

    response = await client.get(f"/zones/{zone_id}/dns_records", params=params)
    data = await decode_response(response)
    results = data.get("result", [])
    if not isinstance(results, list):
        return []
    return [item for item in results if isinstance(item, dict)]

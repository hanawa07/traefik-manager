from fastapi import HTTPException

from app.infrastructure.cloudflare.client import CF_ZONE_CONFIGS_KEY, CloudflareClient, CloudflareZoneConfig
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
)


async def update_cloudflare_settings_values(
    repo: SQLiteSystemSettingsRepository,
    request: CloudflareSettingsUpdateRequest,
) -> tuple[CloudflareSettingsStatusResponse, CloudflareSettingsStatusResponse]:
    previous_status = CloudflareClient.from_db_settings(await repo.get_all_dict()).get_status()

    if not request.zones:
        for key in ("cf_api_token", "cf_zone_id", "cf_record_target", "cf_proxied", CF_ZONE_CONFIGS_KEY):
            await repo.delete(key)
    else:
        zone_configs = [
            CloudflareZoneConfig(
                api_token=item.api_token,
                zone_id=item.zone_id,
                record_target=item.record_target or None,
                proxied=item.proxied,
            )
            for item in request.zones
        ]
        validation_client = CloudflareClient(zone_configs=zone_configs)
        for config in zone_configs:
            zone_name = await validation_client.get_zone_name(config)
            if not zone_name:
                raise HTTPException(status_code=422, detail=f"Zone ID {config.zone_id}의 영역 이름을 확인할 수 없습니다")

        await repo.set(CF_ZONE_CONFIGS_KEY, CloudflareClient.serialize_zone_configs(zone_configs))
        for key in ("cf_api_token", "cf_zone_id", "cf_record_target", "cf_proxied"):
            await repo.delete(key)

    current_status = CloudflareClient.from_db_settings(await repo.get_all_dict()).get_status()
    return previous_status, current_status

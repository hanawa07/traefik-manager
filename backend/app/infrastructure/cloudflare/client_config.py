from app.core.config import settings
from app.infrastructure.cloudflare.zone_config import (
    CF_ZONE_CONFIGS_KEY,
    CloudflareZoneConfig,
    parse_zone_configs,
)


def build_zone_configs(
    *,
    zone_configs: list[CloudflareZoneConfig] | None,
    api_token: str | None,
    zone_id: str | None,
    record_target: str | None,
    proxied: bool | None,
) -> list[CloudflareZoneConfig]:
    if zone_configs is not None:
        return [config for config in zone_configs if config.api_token and config.zone_id]

    effective_api_token = api_token or settings.CLOUDFLARE_API_TOKEN
    effective_zone_id = zone_id or settings.CLOUDFLARE_ZONE_ID
    if not effective_api_token or not effective_zone_id:
        return []

    return [
        CloudflareZoneConfig(
            api_token=effective_api_token,
            zone_id=effective_zone_id,
            record_target=record_target or settings.CLOUDFLARE_RECORD_TARGET,
            proxied=proxied if proxied is not None else settings.CLOUDFLARE_PROXIED,
        )
    ]


def build_zone_configs_from_db_settings(db_settings: dict[str, str]) -> list[CloudflareZoneConfig]:
    zone_configs = parse_zone_configs(db_settings.get(CF_ZONE_CONFIGS_KEY))
    if zone_configs:
        return zone_configs

    proxied: bool | None = None
    if "cf_proxied" in db_settings:
        proxied = db_settings["cf_proxied"] == "true"

    return build_zone_configs(
        zone_configs=None,
        api_token=db_settings.get("cf_api_token") or None,
        zone_id=db_settings.get("cf_zone_id") or None,
        record_target=db_settings.get("cf_record_target") or None,
        proxied=proxied,
    )


def build_cloudflare_status(zone_configs: list[CloudflareZoneConfig]) -> dict:
    zones = [
        {
            "zone_id": config.zone_id,
            "zone_name": config.zone_name,
            "record_target": config.record_target,
            "proxied": config.proxied,
        }
        for config in sorted(zone_configs, key=lambda item: item.zone_name or item.zone_id)
    ]
    enabled = bool(zone_configs)
    return {
        "enabled": enabled,
        "configured": enabled,
        "zone_count": len(zones),
        "zones": zones,
        "message": (
            f"Cloudflare 자동 연동이 {len(zones)}개 영역에 대해 활성화되어 있습니다"
            if enabled
            else "Cloudflare 설정값이 없어 자동 연동이 비활성화되어 있습니다"
        ),
    }

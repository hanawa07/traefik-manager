from dataclasses import dataclass
import json

CF_ZONE_CONFIGS_KEY = "cf_zone_configs"


@dataclass
class CloudflareZoneConfig:
    api_token: str
    zone_id: str
    zone_name: str | None = None
    record_target: str | None = None
    proxied: bool = False

    def matches_domain(self, domain: str) -> bool:
        if not self.zone_name:
            return False
        return domain == self.zone_name or domain.endswith(f".{self.zone_name}")


def parse_zone_configs(raw: str | None) -> list[CloudflareZoneConfig]:
    if not raw:
        return []

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(payload, list):
        return []

    zone_configs: list[CloudflareZoneConfig] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        api_token = item.get("api_token")
        zone_id = item.get("zone_id")
        zone_name = item.get("zone_name")
        if not isinstance(api_token, str) or not api_token.strip():
            continue
        if not isinstance(zone_id, str) or not zone_id.strip():
            continue
        zone_configs.append(
            CloudflareZoneConfig(
                api_token=api_token.strip(),
                zone_id=zone_id.strip(),
                zone_name=zone_name.strip().lower() if isinstance(zone_name, str) and zone_name.strip() else None,
                record_target=item.get("record_target").strip()
                if isinstance(item.get("record_target"), str) and item.get("record_target").strip()
                else None,
                proxied=bool(item.get("proxied", False)),
            )
        )
    return zone_configs


def serialize_zone_configs(zone_configs: list[CloudflareZoneConfig]) -> str:
    return json.dumps(
        [
            {
                "api_token": config.api_token,
                "zone_id": config.zone_id,
                "zone_name": config.zone_name,
                "record_target": config.record_target,
                "proxied": config.proxied,
            }
            for config in zone_configs
        ]
    )

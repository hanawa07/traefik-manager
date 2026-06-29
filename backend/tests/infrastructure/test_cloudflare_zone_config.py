import json

from app.infrastructure.cloudflare.client import CloudflareClient
from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig


def test_parse_zone_configs_normalizes_valid_rows_and_skips_invalid_rows():
    raw = json.dumps(
        [
            {
                "api_token": " token-a ",
                "zone_id": " zone-a ",
                "zone_name": " Example.COM ",
                "record_target": " 220.117.211.140 ",
                "proxied": True,
            },
            {"api_token": "", "zone_id": "zone-b"},
            "invalid-row",
        ]
    )

    configs = CloudflareClient.parse_zone_configs(raw)

    assert len(configs) == 1
    assert configs[0].api_token == "token-a"
    assert configs[0].zone_id == "zone-a"
    assert configs[0].zone_name == "example.com"
    assert configs[0].record_target == "220.117.211.140"
    assert configs[0].proxied is True


def test_parse_zone_configs_returns_empty_list_for_invalid_json():
    assert CloudflareClient.parse_zone_configs("{not-json") == []


def test_serialize_zone_configs_keeps_existing_client_static_api():
    raw = CloudflareClient.serialize_zone_configs(
        [
            CloudflareZoneConfig(
                api_token="token-a",
                zone_id="zone-a",
                zone_name="example.com",
                record_target="220.117.211.140",
                proxied=True,
            )
        ]
    )

    assert json.loads(raw) == [
        {
            "api_token": "token-a",
            "zone_id": "zone-a",
            "zone_name": "example.com",
            "record_target": "220.117.211.140",
            "proxied": True,
        }
    ]

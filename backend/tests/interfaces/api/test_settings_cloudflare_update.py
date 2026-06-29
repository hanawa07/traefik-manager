import pytest

from app.interfaces.api.v1.routers import settings_cloudflare_router as settings_router
from app.interfaces.api.v1.schemas.settings_schemas import CloudflareSettingsUpdateRequest
from tests.interfaces.api.settings_cloudflare_router_fakes import (
    fake_get_known_zone_name,
    make_http_request,
    patch_audit_recording,
)
from tests.interfaces.api.settings_router_fakes import StubSettingsRepository


@pytest.mark.asyncio
async def test_update_cloudflare_settings_persists_multi_zone_and_records_audit(monkeypatch):
    StubSettingsRepository.store = {
        "cf_api_token": "legacy-token",
        "cf_zone_id": "legacy-zone",
        "cf_record_target": "220.117.211.140",
        "cf_proxied": "true",
    }
    recorded = patch_audit_recording(monkeypatch, "203.0.113.21")
    monkeypatch.setattr(settings_router, "SQLiteSystemSettingsRepository", StubSettingsRepository)
    monkeypatch.setattr(settings_router.CloudflareClient, "get_zone_name", fake_get_known_zone_name)

    response = await settings_router.update_cloudflare_settings(
        request=CloudflareSettingsUpdateRequest(
            zones=[
                {
                    "api_token": "token-1",
                    "zone_id": "zone-1",
                    "record_target": "220.117.211.140",
                    "proxied": True,
                },
                {
                    "api_token": "token-2",
                    "zone_id": "zone-2",
                    "record_target": "220.117.211.140",
                    "proxied": False,
                },
            ]
        ),
        db=object(),
        _={"role": "admin", "username": "admin"},
        http_request=make_http_request(),
    )

    assert response["enabled"] is True
    assert response["zone_count"] == 2
    assert "cf_api_token" not in StubSettingsRepository.store
    assert "cf_zone_id" not in StubSettingsRepository.store
    assert "cf_record_target" not in StubSettingsRepository.store
    assert "cf_proxied" not in StubSettingsRepository.store
    assert settings_router.CF_ZONE_CONFIGS_KEY in StubSettingsRepository.store
    assert recorded[0]["detail"]["event"] == "settings_update_cloudflare"
    assert recorded[0]["detail"]["after"]["zone_count"] == 2
    assert recorded[0]["detail"]["after"]["zones"][0]["zone_name"] == "hanastay.co.kr"
    assert recorded[0]["detail"]["after"]["zones"][1]["zone_name"] == "lizstudio.co.kr"
    assert recorded[0]["detail"]["client_ip"] == "203.0.113.21"


def test_cloudflare_settings_update_request_normalizes_multiple_zones_and_skips_empty_rows():
    request = CloudflareSettingsUpdateRequest(
        zones=[
            {
                "api_token": " token-a ",
                "zone_id": " zone-a ",
                "record_target": " 220.117.211.140 ",
                "proxied": True,
            },
            {
                "api_token": "",
                "zone_id": "",
                "record_target": "",
                "proxied": False,
            },
            {
                "api_token": "token-b",
                "zone_id": "zone-b",
                "record_target": "",
                "proxied": False,
            },
        ]
    )

    assert len(request.zones) == 2
    assert request.zones[0].api_token == "token-a"
    assert request.zones[0].zone_id == "zone-a"
    assert request.zones[0].record_target == "220.117.211.140"
    assert request.zones[1].zone_id == "zone-b"

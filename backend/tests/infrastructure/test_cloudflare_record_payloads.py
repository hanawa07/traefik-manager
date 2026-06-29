import pytest

from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.infrastructure.cloudflare.record_payloads import MANAGED_RECORD_COMMENT
from app.infrastructure.cloudflare.zone_config import CloudflareZoneConfig


def test_build_service_record_payload_uses_fallback_ip_as_a_record():
    client = CloudflareClient(zone_configs=[])

    payload = client.build_service_record_payload(
        domain="app.example.com",
        fallback_target="192.0.2.10",
    )

    assert payload == {
        "type": "A",
        "name": "app.example.com",
        "content": "192.0.2.10",
        "ttl": 1,
        "proxied": False,
        "comment": MANAGED_RECORD_COMMENT,
    }


def test_build_service_record_payload_prefers_zone_target_and_proxy_flag():
    client = CloudflareClient(zone_configs=[])
    zone_config = CloudflareZoneConfig(
        api_token="token",
        zone_id="zone",
        record_target="target.example.com",
        proxied=True,
    )

    payload = client.build_service_record_payload(
        domain="app.example.com",
        fallback_target="192.0.2.10",
        zone_config=zone_config,
    )

    assert payload["type"] == "CNAME"
    assert payload["content"] == "target.example.com"
    assert payload["proxied"] is True


def test_build_service_record_payload_rejects_empty_target():
    client = CloudflareClient(zone_configs=[])

    with pytest.raises(CloudflareClientError, match="레코드 대상"):
        client.build_service_record_payload(domain="app.example.com", fallback_target=" ")


def test_detect_record_type_keeps_existing_client_helper():
    assert CloudflareClient._detect_record_type("192.0.2.10") == "A"
    assert CloudflareClient._detect_record_type("2001:db8::1") == "AAAA"
    assert CloudflareClient._detect_record_type("target.example.com") == "CNAME"

from types import SimpleNamespace

import pytest

from app.infrastructure.cloudflare.dns_records import upsert_service_dns_record


class FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload


class FakeClient:
    def __init__(self, existing: list[dict]):
        self.existing = existing
        self.put_calls: list[tuple[str, dict]] = []
        self.post_calls: list[tuple[str, dict]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get(self, *_args, **_kwargs):
        return FakeResponse({"success": True, "result": self.existing})

    async def put(self, path: str, *, json: dict):
        self.put_calls.append((path, json))
        return FakeResponse({"success": True, "result": {"id": "updated-record"}})

    async def post(self, path: str, *, json: dict):
        self.post_calls.append((path, json))
        return FakeResponse({"success": True, "result": {"id": "created-record"}})


async def decode_response(response: FakeResponse) -> dict:
    return response.payload


def record_payload() -> dict[str, object]:
    return {
        "type": "A",
        "name": "uptime.example.com",
        "content": "203.0.113.10",
        "ttl": 1,
        "proxied": True,
        "comment": "managed-by-traefik-manager",
    }


@pytest.mark.asyncio
async def test_upsert_skips_write_when_record_already_matches():
    existing = {
        "id": "existing-record",
        "modified_on": "2026-09-01T00:00:00Z",
        **record_payload(),
    }
    client = FakeClient([existing])

    record_id = await upsert_service_dns_record(
        client_factory=lambda _: client,
        decode_response=decode_response,
        zone_config=SimpleNamespace(zone_id="zone-id"),
        domain="uptime.example.com",
        payload=record_payload(),
    )

    assert record_id == "existing-record"
    assert client.put_calls == []
    assert client.post_calls == []


@pytest.mark.asyncio
async def test_upsert_updates_record_when_managed_fields_differ():
    existing = {"id": "existing-record", **record_payload(), "proxied": False}
    client = FakeClient([existing])

    record_id = await upsert_service_dns_record(
        client_factory=lambda _: client,
        decode_response=decode_response,
        zone_config=SimpleNamespace(zone_id="zone-id"),
        domain="uptime.example.com",
        payload=record_payload(),
    )

    assert record_id == "updated-record"
    assert len(client.put_calls) == 1
    assert client.post_calls == []

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.proxy.service_cloudflare_records import (
    delete_cloudflare_record,
    rollback_cloudflare_record,
    sync_cloudflare_record,
)


class RecordingCloudflareClient:
    def __init__(self, *, enabled: bool = False, fail_delete: bool = False):
        self.enabled = enabled
        self.fail_delete = fail_delete
        self.upserts: list[dict[str, str]] = []
        self.deletes: list[dict[str, str | None]] = []

    async def upsert_service_record(self, **kwargs):
        self.upserts.append(kwargs)
        return "record-new"

    async def delete_service_record(self, **kwargs):
        self.deletes.append(kwargs)
        if self.fail_delete:
            raise RuntimeError("cloudflare delete failed")


def make_service(**overrides):
    data = {
        "id": uuid4(),
        "name": "svc",
        "domain": "svc.example.com",
        "upstream_host": "backend-app",
        "cloudflare_record_id": "record-old",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


@pytest.mark.asyncio
async def test_sync_cloudflare_record_updates_record_id():
    client = RecordingCloudflareClient(enabled=False)
    service = make_service(cloudflare_record_id=None)

    await sync_cloudflare_record(client, service)

    assert service.cloudflare_record_id == "record-new"
    assert client.upserts == [
        {
            "domain": "svc.example.com",
            "fallback_target": "backend-app",
        }
    ]


@pytest.mark.asyncio
async def test_sync_cloudflare_record_skips_when_enabled_required_and_disabled():
    client = RecordingCloudflareClient(enabled=False)
    service = make_service()

    await sync_cloudflare_record(client, service, require_enabled=True)

    assert service.cloudflare_record_id == "record-old"
    assert client.upserts == []


@pytest.mark.asyncio
async def test_rollback_cloudflare_record_suppresses_delete_failure():
    client = RecordingCloudflareClient(enabled=True, fail_delete=True)
    service = make_service()

    await rollback_cloudflare_record(client, service)

    assert client.deletes == [
        {
            "domain": "svc.example.com",
            "record_id": "record-old",
        }
    ]


@pytest.mark.asyncio
async def test_delete_cloudflare_record_propagates_delete_failure():
    client = RecordingCloudflareClient(enabled=True, fail_delete=True)
    service = make_service()

    with pytest.raises(RuntimeError, match="cloudflare delete failed"):
        await delete_cloudflare_record(client, service)

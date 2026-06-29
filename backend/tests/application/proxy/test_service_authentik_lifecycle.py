import pytest

from app.application.proxy.service_authentik_lifecycle import ServiceAuthentikLifecycle
from app.domain.proxy.entities.service import Service


class RecordingAuthentikSync:
    def __init__(self):
        self.calls = []

    async def setup(self, service):
        self.calls.append(("setup", str(service.domain)))

    async def teardown(self, service):
        self.calls.append(("teardown", str(service.domain)))

    async def sync_group_policy(self, service):
        self.calls.append(("sync_group_policy", service.authentik_group_id))

    async def count_services(self, exclude_id=None):
        self.calls.append(("count_services", exclude_id))
        return 0


class RecordingFileWriter:
    def __init__(self):
        self.calls = []

    def write_authentik_middleware(self):
        self.calls.append(("write_authentik_middleware",))

    def delete_authentik_middleware_if_unused(self, remaining):
        self.calls.append(("delete_authentik_middleware_if_unused", remaining))


def make_authentik_service(**overrides):
    data = {
        "name": "svc",
        "domain": "svc.example.com",
        "upstream_host": "example.com",
        "upstream_port": 8080,
        "tls_enabled": True,
        "auth_mode": "authentik",
        "authentik_group_id": "group-1",
    }
    data.update(overrides)
    return Service.create(**data)


@pytest.mark.asyncio
async def test_setup_created_service_writes_authentik_middleware():
    sync = RecordingAuthentikSync()
    writer = RecordingFileWriter()
    lifecycle = ServiceAuthentikLifecycle(sync, writer)
    service = make_authentik_service()

    await lifecycle.setup_created_service(service)

    assert sync.calls == [("setup", "svc.example.com")]
    assert writer.calls == [("write_authentik_middleware",)]


@pytest.mark.asyncio
async def test_sync_updated_service_tears_down_even_after_auth_mode_is_disabled():
    sync = RecordingAuthentikSync()
    writer = RecordingFileWriter()
    lifecycle = ServiceAuthentikLifecycle(sync, writer)
    service = make_authentik_service()
    service.update(auth_mode="none")

    await lifecycle.sync_updated_service(
        service=service,
        old_auth_mode="authentik",
        previous_group_id="group-1",
    )

    assert sync.calls == [
        ("teardown", "svc.example.com"),
        ("count_services", service.id),
    ]
    assert writer.calls == [("delete_authentik_middleware_if_unused", 0)]


@pytest.mark.asyncio
async def test_sync_updated_service_syncs_group_policy_when_group_changes():
    sync = RecordingAuthentikSync()
    writer = RecordingFileWriter()
    lifecycle = ServiceAuthentikLifecycle(sync, writer)
    service = make_authentik_service()
    service.authentik_group_id = "group-2"

    await lifecycle.sync_updated_service(
        service=service,
        old_auth_mode="authentik",
        previous_group_id="group-1",
    )

    assert sync.calls == [("sync_group_policy", "group-2")]
    assert writer.calls == []


@pytest.mark.asyncio
async def test_delete_lifecycle_tears_down_then_cleans_middleware():
    sync = RecordingAuthentikSync()
    writer = RecordingFileWriter()
    lifecycle = ServiceAuthentikLifecycle(sync, writer)
    service = make_authentik_service()

    await lifecycle.teardown_deleted_service(service)
    await lifecycle.cleanup_deleted_service(service)

    assert sync.calls == [
        ("teardown", "svc.example.com"),
        ("count_services", service.id),
    ]
    assert writer.calls == [("delete_authentik_middleware_if_unused", 0)]

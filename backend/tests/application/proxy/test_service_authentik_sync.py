import pytest

from app.application.proxy.service_authentik_sync import ServiceAuthentikSync
from app.domain.proxy.entities.service import Service


class RecordingAuthentikClient:
    def __init__(self):
        self.calls = []

    async def list_groups(self):
        self.calls.append(("list_groups",))
        return [{"id": "group-1", "name": "Admins"}]

    async def create_proxy_provider(self, **kwargs):
        self.calls.append(("create_proxy_provider", kwargs))
        return {"pk": 101}

    async def create_application(self, **kwargs):
        self.calls.append(("create_application", kwargs))
        return {"pk": 202}

    async def get_group(self, group_id: str):
        self.calls.append(("get_group", group_id))
        if group_id != "group-1":
            return None
        return {"id": group_id, "name": "Admins"}

    async def get_application_by_slug(self, slug: str):
        self.calls.append(("get_application_by_slug", slug))
        return {"pk": 202}

    async def create_group_policy(self, **kwargs):
        self.calls.append(("create_group_policy", kwargs))
        return {"pk": 303}

    async def bind_policy_to_application(self, **kwargs):
        self.calls.append(("bind_policy_to_application", kwargs))
        return {"pk": 404}

    async def delete_policy_binding(self, binding_id: str):
        self.calls.append(("delete_policy_binding", binding_id))

    async def delete_policy(self, policy_id: str):
        self.calls.append(("delete_policy", policy_id))

    async def delete_application(self, slug: str):
        self.calls.append(("delete_application", slug))

    async def delete_provider(self, provider_id: str):
        self.calls.append(("delete_provider", provider_id))


class StubServiceRepository:
    def __init__(self, services):
        self.services = services

    async def find_all(self):
        return self.services


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
async def test_setup_creates_provider_application_and_group_policy():
    client = RecordingAuthentikClient()
    service = make_authentik_service()
    sync = ServiceAuthentikSync(client, StubServiceRepository([]))

    await sync.setup(service)

    assert service.authentik_provider_id == "101"
    assert service.authentik_app_slug == "svc-example-com"
    assert service.authentik_group_name == "Admins"
    assert service.authentik_policy_id == "303"
    assert service.authentik_policy_binding_id == "404"
    assert client.calls == [
        ("create_proxy_provider", {"name": "svc", "domain": "svc.example.com"}),
        (
            "create_application",
            {"name": "svc", "slug": "svc-example-com", "provider_pk": 101},
        ),
        ("get_group", "group-1"),
        (
            "create_group_policy",
            {"name": "svc-svc.example.com-group-policy", "group_name": "Admins"},
        ),
        (
            "bind_policy_to_application",
            {"application_pk": "202", "policy_pk": "303"},
        ),
    ]


@pytest.mark.asyncio
async def test_sync_group_policy_replaces_existing_policy_binding():
    client = RecordingAuthentikClient()
    service = make_authentik_service()
    service.authentik_app_slug = "svc-example-com"
    service.authentik_policy_id = "old-policy"
    service.authentik_policy_binding_id = "old-binding"
    sync = ServiceAuthentikSync(client, StubServiceRepository([]))

    await sync.sync_group_policy(service)

    assert service.authentik_group_name == "Admins"
    assert service.authentik_policy_id == "303"
    assert service.authentik_policy_binding_id == "404"
    assert client.calls[:4] == [
        ("delete_policy_binding", "old-binding"),
        ("delete_policy", "old-policy"),
        ("get_group", "group-1"),
        ("get_application_by_slug", "svc-example-com"),
    ]


@pytest.mark.asyncio
async def test_teardown_deletes_authentik_resources_and_clears_service_state():
    client = RecordingAuthentikClient()
    service = make_authentik_service()
    service.authentik_provider_id = "provider-1"
    service.authentik_app_slug = "app-slug"
    service.authentik_policy_id = "policy-1"
    service.authentik_policy_binding_id = "binding-1"
    sync = ServiceAuthentikSync(client, StubServiceRepository([]))

    await sync.teardown(service)

    assert service.authentik_provider_id is None
    assert service.authentik_app_slug is None
    assert service.authentik_group_id is None
    assert service.authentik_policy_id is None
    assert service.authentik_policy_binding_id is None
    assert client.calls == [
        ("delete_policy_binding", "binding-1"),
        ("delete_policy", "policy-1"),
        ("delete_application", "app-slug"),
        ("delete_provider", "provider-1"),
    ]


@pytest.mark.asyncio
async def test_count_services_excludes_service_id_or_uuid():
    first = make_authentik_service(name="first", domain="first.example.com")
    second = make_authentik_service(name="second", domain="second.example.com")
    disabled = make_authentik_service(name="disabled", domain="disabled.example.com")
    disabled.update(auth_mode="none")
    sync = ServiceAuthentikSync(RecordingAuthentikClient(), StubServiceRepository([first, second, disabled]))

    assert await sync.count_services() == 2
    assert await sync.count_services(exclude_id=first.id) == 1
    assert await sync.count_services(exclude_id=first.id.value) == 1

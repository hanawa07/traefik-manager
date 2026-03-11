from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.proxy.service_use_cases import ServiceUseCases
from app.domain.proxy.entities.service import Service


class StubServiceRepository:
    def __init__(self):
        self.saved = []

    async def find_by_domain(self, _domain):
        return None

    async def save(self, service):
        self.saved.append(service)


class StubMiddlewareTemplateRepository:
    async def find_many_by_ids(self, _template_ids):
        return []


class StubFileWriter:
    def write(self, *_args, **_kwargs):
        return None

    def delete(self, *_args, **_kwargs):
        return None

    def write_authentik_middleware(self):
        return None


class StubAuthentikClient:
    pass


class StubCloudflareClient:
    enabled = False

    async def upsert_service_record(self, **_kwargs):
        return None


class RecordingUpstreamGuard:
    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.calls: list[str] = []

    async def ensure_safe(self, host: str) -> None:
        self.calls.append(host)
        if self.should_fail:
            raise ValueError(f"strict rejected: {host}")


def make_payload(**overrides):
    data = {
        "name": "svc",
        "domain": "svc.example.com",
        "upstream_host": "example.com",
        "upstream_port": 8080,
        "tls_enabled": True,
        "auth_mode": "none",
        "api_key": None,
        "https_redirect_enabled": True,
        "allowed_ips": [],
        "blocked_paths": [],
        "rate_limit_average": None,
        "rate_limit_burst": None,
        "custom_headers": {},
        "basic_auth_enabled": False,
        "basic_auth_credentials": [],
        "middleware_template_ids": [],
        "authentik_group_id": None,
        "upstream_scheme": "http",
        "skip_tls_verify": False,
        "frame_policy": "deny",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


@pytest.mark.asyncio
async def test_create_service_validates_upstream_host_with_dns_guard():
    guard = RecordingUpstreamGuard()
    use_cases = ServiceUseCases(
        repository=StubServiceRepository(),
        middleware_template_repository=StubMiddlewareTemplateRepository(),
        file_writer=StubFileWriter(),
        authentik_client=StubAuthentikClient(),
        cloudflare_client=StubCloudflareClient(),
        upstream_guard=guard,
    )

    await use_cases.create_service(make_payload())

    assert guard.calls == ["example.com"]


@pytest.mark.asyncio
async def test_create_service_propagates_dns_guard_failure():
    guard = RecordingUpstreamGuard(should_fail=True)
    use_cases = ServiceUseCases(
        repository=StubServiceRepository(),
        middleware_template_repository=StubMiddlewareTemplateRepository(),
        file_writer=StubFileWriter(),
        authentik_client=StubAuthentikClient(),
        cloudflare_client=StubCloudflareClient(),
        upstream_guard=guard,
    )

    with pytest.raises(ValueError, match="strict rejected: example.com"):
        await use_cases.create_service(make_payload())


@pytest.mark.asyncio
async def test_create_service_hashes_basic_auth_users_with_bcrypt_htpasswd():
    use_cases = ServiceUseCases(
        repository=StubServiceRepository(),
        middleware_template_repository=StubMiddlewareTemplateRepository(),
        file_writer=StubFileWriter(),
        authentik_client=StubAuthentikClient(),
        cloudflare_client=StubCloudflareClient(),
    )

    service = await use_cases.create_service(
        make_payload(
            basic_auth_enabled=True,
            basic_auth_credentials=[{"username": "alice", "password": "secret123"}],
        )
    )

    assert len(service.basic_auth_users) == 1
    username, hashed_password = service.basic_auth_users[0].split(":", 1)
    assert username == "alice"
    assert hashed_password.startswith("$2")

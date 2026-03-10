from datetime import datetime
from uuid import uuid4

import pytest

from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)


class StubAsyncSession:
    def __init__(self):
        self.added = None

    async def get(self, *_args, **_kwargs):
        return None

    def add(self, model):
        self.added = model


@pytest.mark.asyncio
async def test_save_persists_api_key_on_insert(make_service):
    session = StubAsyncSession()
    repository = SQLiteServiceRepository(session)
    service = make_service(auth_mode="token")

    await repository.save(service)

    assert session.added is not None
    assert session.added.auth_mode == "token"
    assert session.added.api_key == service.api_key


def test_to_entity_restores_api_key():
    now = datetime.utcnow()
    api_key = "service_test_key"
    model = ServiceModel(
        id=str(uuid4()),
        name="token-service",
        domain="token.example.com",
        upstream_host="10.0.0.1",
        upstream_port=8080,
        upstream_scheme="https",
        skip_tls_verify=True,
        tls_enabled=True,
        https_redirect_enabled=True,
        auth_enabled=True,
        auth_mode="token",
        api_key=api_key,
        allowed_ips=[],
        blocked_paths=[],
        rate_limit_average=None,
        rate_limit_burst=None,
        custom_headers={},
        basic_auth_users=[],
        middleware_template_ids=[],
        created_at=now,
        updated_at=now,
    )

    repository = SQLiteServiceRepository(None)
    service = repository._to_entity(model)

    assert service.auth_mode == "token"
    assert service.api_key == api_key
    assert service.upstream_scheme == "https"
    assert service.skip_tls_verify is True


def test_to_entity_restores_frame_policy():
    now = datetime.utcnow()
    model = ServiceModel(
        id=str(uuid4()),
        name="cockpit-service",
        domain="cockpit.example.com",
        upstream_host="10.0.0.1",
        upstream_port=9090,
        upstream_scheme="http",
        skip_tls_verify=False,
        tls_enabled=True,
        https_redirect_enabled=True,
        auth_enabled=False,
        auth_mode="none",
        api_key=None,
        allowed_ips=[],
        blocked_paths=[],
        rate_limit_average=None,
        rate_limit_burst=None,
        custom_headers={},
        basic_auth_users=[],
        middleware_template_ids=[],
        frame_policy="sameorigin",
        created_at=now,
        updated_at=now,
    )

    repository = SQLiteServiceRepository(None)
    service = repository._to_entity(model)

    assert service.frame_policy == "sameorigin"

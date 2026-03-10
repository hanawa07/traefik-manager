import pytest

from app.infrastructure.traefik.startup_sync import sync_existing_service_configs


class StubServiceRepository:
    def __init__(self, services):
        self._services = services

    async def find_all(self):
        return self._services


class StubMiddlewareTemplateRepository:
    async def find_many_by_ids(self, _template_ids):
        return []


class RecordingFileWriter:
    def __init__(self):
        self.calls = []

    def write(self, service, middleware_templates=None):
        self.calls.append((service, middleware_templates or []))


@pytest.mark.asyncio
async def test_sync_existing_service_configs_rewrites_all_services(make_service):
    services = [
        make_service(domain="alpha.example.com"),
        make_service(domain="beta.example.com", frame_policy="sameorigin"),
    ]
    writer = RecordingFileWriter()

    rewritten = await sync_existing_service_configs(
        service_repository=StubServiceRepository(services),
        middleware_template_repository=StubMiddlewareTemplateRepository(),
        file_writer=writer,
    )

    assert rewritten == 2
    assert [str(call[0].domain) for call in writer.calls] == ["alpha.example.com", "beta.example.com"]
    assert writer.calls[0][1] == []

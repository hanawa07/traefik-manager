import pytest

from app.infrastructure.traefik.startup_sync import (
    sync_existing_service_configs,
    sync_traefik_dashboard_public_config,
)


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
        self.dashboard_write_calls = []
        self.dashboard_deleted = False

    def write(self, service, middleware_templates=None):
        self.calls.append((service, middleware_templates or []))

    def write_traefik_dashboard_public_route(self, domain, basic_auth_username, basic_auth_password_hash):
        self.dashboard_write_calls.append((domain, basic_auth_username, basic_auth_password_hash))

    def delete_traefik_dashboard_public_route(self):
        self.dashboard_deleted = True


class StubSettingsRepository:
    def __init__(self, items):
        self._items = items

    async def get(self, key):
        return self._items.get(key)


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


@pytest.mark.asyncio
async def test_sync_traefik_dashboard_public_config_writes_when_enabled():
    writer = RecordingFileWriter()

    enabled = await sync_traefik_dashboard_public_config(
        settings_repository=StubSettingsRepository(
            {
                "traefik_dashboard_public_enabled": "true",
                "traefik_dashboard_public_domain": "traefik-debug.example.com",
                "traefik_dashboard_public_auth_username": "debug-admin",
                "traefik_dashboard_public_auth_password_hash": "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
            }
        ),
        file_writer=writer,
    )

    assert enabled is True
    assert writer.dashboard_write_calls == [
        (
            "traefik-debug.example.com",
            "debug-admin",
            "$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
        )
    ]
    assert writer.dashboard_deleted is False


@pytest.mark.asyncio
async def test_sync_traefik_dashboard_public_config_deletes_when_disabled():
    writer = RecordingFileWriter()

    enabled = await sync_traefik_dashboard_public_config(
        settings_repository=StubSettingsRepository(
            {
                "traefik_dashboard_public_enabled": "false",
            }
        ),
        file_writer=writer,
    )

    assert enabled is False
    assert writer.dashboard_write_calls == []
    assert writer.dashboard_deleted is True

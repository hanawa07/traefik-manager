from uuid import UUID

import pytest

from app.application.backup.backup_use_cases import BackupUseCases
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service


class StubServiceRepository:
    def __init__(self, services: list[Service]):
        self.services = services

    async def save(self, _service: Service) -> None:
        return None

    async def find_by_id(self, service_id: UUID) -> Service | None:
        return next((service for service in self.services if service.id.value == service_id), None)

    async def find_all(self) -> list[Service]:
        return list(self.services)

    async def find_by_domain(self, domain: str) -> Service | None:
        return next((service for service in self.services if str(service.domain) == domain), None)

    async def delete(self, _service_id: UUID) -> None:
        return None


class StubRedirectHostRepository:
    def __init__(self, redirect_hosts: list[RedirectHost]):
        self.redirect_hosts = redirect_hosts

    async def save(self, _redirect_host: RedirectHost) -> None:
        return None

    async def find_by_id(self, redirect_id: UUID) -> RedirectHost | None:
        return next((item for item in self.redirect_hosts if item.id == redirect_id), None)

    async def find_all(self) -> list[RedirectHost]:
        return list(self.redirect_hosts)

    async def find_by_domain(self, domain: str) -> RedirectHost | None:
        return next((item for item in self.redirect_hosts if str(item.domain) == domain), None)

    async def delete(self, _redirect_id: UUID) -> None:
        return None


class StubMiddlewareTemplateRepository:
    async def find_many_by_ids(self, _template_ids):
        return []


class StubFileWriter:
    def write(self, *_args, **_kwargs):
        return None

    def delete(self, *_args, **_kwargs):
        return None

    def write_redirect_host(self, *_args, **_kwargs):
        return None

    def delete_redirect_host(self, *_args, **_kwargs):
        return None

    def delete_redirect_host_by_domain(self, *_args, **_kwargs):
        return None


def build_use_cases(*, services: list[Service], redirect_hosts: list[RedirectHost]) -> BackupUseCases:
    return BackupUseCases(
        service_repository=StubServiceRepository(services),
        middleware_template_repository=StubMiddlewareTemplateRepository(),
        redirect_repository=StubRedirectHostRepository(redirect_hosts),
        file_writer=StubFileWriter(),
    )


@pytest.mark.asyncio
async def test_preview_import_merge_splits_service_and_redirect_changes():
    use_cases = build_use_cases(
        services=[
            Service.create(
                name="home",
                domain="home.example.com",
                upstream_host="homepage",
                upstream_port=3000,
                auth_enabled=False,
            )
        ],
        redirect_hosts=[
            RedirectHost.create(
                domain="go.example.com",
                target_url="https://example.com/docs",
            )
        ],
    )

    preview = await use_cases.preview_import(
        mode="merge",
        payload={
            "services": [
                {
                    "name": "home",
                    "domain": "home.example.com",
                    "upstream_host": "homepage-v2",
                    "upstream_port": 3001,
                    "auth_enabled": False,
                },
                {
                    "name": "grafana",
                    "domain": "monitor.example.com",
                    "upstream_host": "grafana",
                    "upstream_port": 3000,
                    "auth_enabled": False,
                },
            ],
            "redirect_hosts": [
                {
                    "domain": "go.example.com",
                    "target_url": "https://example.com/new-docs",
                    "permanent": True,
                    "tls_enabled": True,
                },
                {
                    "domain": "status.example.com",
                    "target_url": "https://status.example.com",
                    "permanent": True,
                    "tls_enabled": True,
                },
            ],
        },
    )

    assert preview["mode"] == "merge"
    assert preview["service_count"] == 2
    assert preview["redirect_count"] == 2
    assert preview["services"]["creates"] == [{"domain": "monitor.example.com", "name": "grafana"}]
    assert preview["services"]["updates"] == [{"domain": "home.example.com", "name": "home"}]
    assert preview["services"]["deletes"] == []
    assert preview["redirect_hosts"]["creates"] == [{"domain": "status.example.com", "name": None}]
    assert preview["redirect_hosts"]["updates"] == [{"domain": "go.example.com", "name": None}]
    assert preview["redirect_hosts"]["deletes"] == []


@pytest.mark.asyncio
async def test_preview_import_overwrite_marks_existing_items_for_delete_and_incoming_for_create():
    use_cases = build_use_cases(
        services=[
            Service.create(
                name="home",
                domain="home.example.com",
                upstream_host="homepage",
                upstream_port=3000,
                auth_enabled=False,
            ),
            Service.create(
                name="grafana",
                domain="monitor.example.com",
                upstream_host="grafana",
                upstream_port=3000,
                auth_enabled=False,
            ),
        ],
        redirect_hosts=[
            RedirectHost.create(
                domain="go.example.com",
                target_url="https://example.com/docs",
            )
        ],
    )

    preview = await use_cases.preview_import(
        mode="overwrite",
        payload={
            "services": [
                {
                    "name": "fresh",
                    "domain": "fresh.example.com",
                    "upstream_host": "fresh",
                    "upstream_port": 8080,
                    "auth_enabled": False,
                }
            ],
            "redirect_hosts": [
                {
                    "domain": "portal.example.com",
                    "target_url": "https://portal.example.com",
                    "permanent": True,
                    "tls_enabled": True,
                }
            ],
        },
    )

    assert preview["mode"] == "overwrite"
    assert preview["services"]["creates"] == [{"domain": "fresh.example.com", "name": "fresh"}]
    assert preview["services"]["updates"] == []
    assert preview["services"]["deletes"] == [
        {"domain": "home.example.com", "name": "home"},
        {"domain": "monitor.example.com", "name": "grafana"},
    ]
    assert preview["redirect_hosts"]["creates"] == [{"domain": "portal.example.com", "name": None}]
    assert preview["redirect_hosts"]["updates"] == []
    assert preview["redirect_hosts"]["deletes"] == [{"domain": "go.example.com", "name": None}]

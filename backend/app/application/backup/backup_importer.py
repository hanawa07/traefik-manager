from app.application.backup.backup_template_resolver import resolve_middleware_templates
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


class BackupImporter:
    def __init__(
        self,
        service_repository: ServiceRepository,
        middleware_template_repository: MiddlewareTemplateRepository,
        redirect_repository: RedirectHostRepository,
        file_writer: FileProviderWriter,
    ):
        self.service_repository = service_repository
        self.middleware_template_repository = middleware_template_repository
        self.redirect_repository = redirect_repository
        self.file_writer = file_writer

    async def import_all(self, mode: str, payload: dict) -> dict:
        stats = {
            "deleted_services": 0,
            "deleted_redirects": 0,
            "created_services": 0,
            "updated_services": 0,
            "created_redirects": 0,
            "updated_redirects": 0,
        }

        if mode == "overwrite":
            stats["deleted_services"], stats["deleted_redirects"] = await self._delete_existing()

        for item in payload.get("services") or []:
            if await self._upsert_service(item):
                stats["updated_services"] += 1
            else:
                stats["created_services"] += 1

        for item in payload.get("redirect_hosts") or []:
            if await self._upsert_redirect(item):
                stats["updated_redirects"] += 1
            else:
                stats["created_redirects"] += 1

        await self._write_shared_middleware_templates()
        return {"mode": mode, **stats}

    async def _delete_existing(self) -> tuple[int, int]:
        deleted_services = 0
        for service in await self.service_repository.find_all():
            self.file_writer.delete(service)
            await self.service_repository.delete(service.id.value)
            deleted_services += 1

        deleted_redirects = 0
        for redirect_host in await self.redirect_repository.find_all():
            self.file_writer.delete_redirect_host(redirect_host)
            await self.redirect_repository.delete(redirect_host.id)
            deleted_redirects += 1

        return deleted_services, deleted_redirects

    async def _upsert_service(self, item: dict) -> bool:
        existing = await self.service_repository.find_by_domain(item["domain"])
        if existing:
            self._update_service(existing, item)
            await self._write_service(existing)
            return True

        created = self._create_service(item)
        await self._write_service(created)
        return False

    def _update_service(self, service: Service, item: dict) -> None:
        clear_rate_limit = item.get("rate_limit_average") is None and item.get("rate_limit_burst") is None
        service.update(
            name=item["name"],
            upstream_host=item["upstream_host"],
            upstream_port=item["upstream_port"],
            routing_mode=item.get("routing_mode", "active"),
            maintenance_message=item.get("maintenance_message", ""),
            maintenance_until=item.get("maintenance_until"),
            clear_maintenance_until=(
                "maintenance_until" in item and item.get("maintenance_until") is None
            ),
            upstream_scheme=item.get("upstream_scheme", "http"),
            skip_tls_verify=item.get("skip_tls_verify", False),
            tls_enabled=item["tls_enabled"],
            auth_enabled=item["auth_enabled"],
            https_redirect_enabled=item["https_redirect_enabled"],
            allowed_ips=item.get("allowed_ips") or [],
            blocked_paths=item.get("blocked_paths") or [],
            rate_limit_average=item.get("rate_limit_average"),
            rate_limit_burst=item.get("rate_limit_burst"),
            custom_headers=item.get("custom_headers") or {},
            frame_policy=item.get("frame_policy", "deny"),
            healthcheck_enabled=item.get("healthcheck_enabled", True),
            healthcheck_path=item.get("healthcheck_path", "/"),
            healthcheck_timeout_ms=item.get("healthcheck_timeout_ms", 3000),
            healthcheck_expected_statuses=item.get("healthcheck_expected_statuses") or [],
            basic_auth_users=item.get("basic_auth_users") or [],
            middleware_template_ids=item.get("middleware_template_ids") or [],
            clear_rate_limit=clear_rate_limit,
        )
        self._assign_service_external_ids(service, item)

    def _create_service(self, item: dict) -> Service:
        service = Service.create(
            name=item["name"],
            domain=item["domain"],
            upstream_host=item["upstream_host"],
            upstream_port=item["upstream_port"],
            routing_mode=item.get("routing_mode", "active"),
            maintenance_message=item.get("maintenance_message", ""),
            maintenance_until=item.get("maintenance_until"),
            upstream_scheme=item.get("upstream_scheme", "http"),
            skip_tls_verify=item.get("skip_tls_verify", False),
            tls_enabled=item["tls_enabled"],
            auth_enabled=item["auth_enabled"],
            https_redirect_enabled=item["https_redirect_enabled"],
            allowed_ips=item.get("allowed_ips") or [],
            blocked_paths=item.get("blocked_paths") or [],
            rate_limit_average=item.get("rate_limit_average"),
            rate_limit_burst=item.get("rate_limit_burst"),
            custom_headers=item.get("custom_headers") or {},
            frame_policy=item.get("frame_policy", "deny"),
            healthcheck_enabled=item.get("healthcheck_enabled", True),
            healthcheck_path=item.get("healthcheck_path", "/"),
            healthcheck_timeout_ms=item.get("healthcheck_timeout_ms", 3000),
            healthcheck_expected_statuses=item.get("healthcheck_expected_statuses") or [],
            basic_auth_users=item.get("basic_auth_users") or [],
            middleware_template_ids=item.get("middleware_template_ids") or [],
            authentik_group_id=item.get("authentik_group_id"),
        )
        self._assign_service_external_ids(service, item)
        return service

    def _assign_service_external_ids(self, service: Service, item: dict) -> None:
        service.authentik_provider_id = item.get("authentik_provider_id")
        service.authentik_app_slug = item.get("authentik_app_slug")
        service.authentik_group_id = item.get("authentik_group_id")
        service.authentik_group_name = item.get("authentik_group_name")
        service.authentik_policy_id = item.get("authentik_policy_id")
        service.authentik_policy_binding_id = item.get("authentik_policy_binding_id")
        service.cloudflare_record_id = item.get("cloudflare_record_id")

    async def _write_service(self, service: Service) -> None:
        middleware_templates = await resolve_middleware_templates(
            self.middleware_template_repository,
            service.middleware_template_ids,
        )
        self.file_writer.write(service, middleware_templates=middleware_templates)
        await self.service_repository.save(service)

    async def _write_shared_middleware_templates(self) -> None:
        self.file_writer.write_shared_middleware_templates(
            await self.middleware_template_repository.find_all()
        )

    async def _upsert_redirect(self, item: dict) -> bool:
        existing = await self.redirect_repository.find_by_domain(item["domain"])
        if existing:
            previous_domain = str(existing.domain)
            existing.update(
                domain=item["domain"],
                target_url=item["target_url"],
                permanent=item["permanent"],
                tls_enabled=item["tls_enabled"],
            )
            if previous_domain != str(existing.domain):
                self.file_writer.delete_redirect_host_by_domain(previous_domain)
            self.file_writer.write_redirect_host(existing)
            await self.redirect_repository.save(existing)
            return True

        created = RedirectHost.create(
            domain=item["domain"],
            target_url=item["target_url"],
            permanent=item["permanent"],
            tls_enabled=item["tls_enabled"],
        )
        self.file_writer.write_redirect_host(created)
        await self.redirect_repository.save(created)
        return False

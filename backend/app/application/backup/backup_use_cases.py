from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service
from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


class BackupUseCases:

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

    async def export_all(self) -> dict:
        services = await self.service_repository.find_all()
        redirects = await self.redirect_repository.find_all()

        return {
            "services": [self._serialize_service(item) for item in services],
            "redirect_hosts": [self._serialize_redirect(item) for item in redirects],
        }

    async def import_all(self, mode: str, payload: dict) -> dict:
        services_payload = payload.get("services") or []
        redirects_payload = payload.get("redirect_hosts") or []

        deleted_services = 0
        deleted_redirects = 0
        created_services = 0
        updated_services = 0
        created_redirects = 0
        updated_redirects = 0

        if mode == "overwrite":
            existing_services = await self.service_repository.find_all()
            for service in existing_services:
                self.file_writer.delete(service)
                await self.service_repository.delete(service.id.value)
                deleted_services += 1

            existing_redirects = await self.redirect_repository.find_all()
            for redirect_host in existing_redirects:
                self.file_writer.delete_redirect_host(redirect_host)
                await self.redirect_repository.delete(redirect_host.id)
                deleted_redirects += 1

        for item in services_payload:
            existing = await self.service_repository.find_by_domain(item["domain"])
            if existing:
                clear_rate_limit = item.get("rate_limit_average") is None and item.get("rate_limit_burst") is None
                existing.update(
                    name=item["name"],
                    upstream_host=item["upstream_host"],
                    upstream_port=item["upstream_port"],
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
                existing.authentik_provider_id = item.get("authentik_provider_id")
                existing.authentik_app_slug = item.get("authentik_app_slug")
                existing.authentik_group_id = item.get("authentik_group_id")
                existing.authentik_group_name = item.get("authentik_group_name")
                existing.authentik_policy_id = item.get("authentik_policy_id")
                existing.authentik_policy_binding_id = item.get("authentik_policy_binding_id")
                existing.cloudflare_record_id = item.get("cloudflare_record_id")

                middleware_templates = await self._resolve_middleware_templates(
                    existing.middleware_template_ids
                )
                self.file_writer.write(existing, middleware_templates=middleware_templates)
                await self.service_repository.save(existing)
                updated_services += 1
            else:
                created = Service.create(
                    name=item["name"],
                    domain=item["domain"],
                    upstream_host=item["upstream_host"],
                    upstream_port=item["upstream_port"],
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
                created.authentik_provider_id = item.get("authentik_provider_id")
                created.authentik_app_slug = item.get("authentik_app_slug")
                created.authentik_group_name = item.get("authentik_group_name")
                created.authentik_policy_id = item.get("authentik_policy_id")
                created.authentik_policy_binding_id = item.get("authentik_policy_binding_id")
                created.cloudflare_record_id = item.get("cloudflare_record_id")

                middleware_templates = await self._resolve_middleware_templates(
                    created.middleware_template_ids
                )
                self.file_writer.write(created, middleware_templates=middleware_templates)
                await self.service_repository.save(created)
                created_services += 1

        for item in redirects_payload:
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
                updated_redirects += 1
            else:
                created = RedirectHost.create(
                    domain=item["domain"],
                    target_url=item["target_url"],
                    permanent=item["permanent"],
                    tls_enabled=item["tls_enabled"],
                )
                self.file_writer.write_redirect_host(created)
                await self.redirect_repository.save(created)
                created_redirects += 1

        return {
            "mode": mode,
            "created_services": created_services,
            "updated_services": updated_services,
            "deleted_services": deleted_services,
            "created_redirects": created_redirects,
            "updated_redirects": updated_redirects,
            "deleted_redirects": deleted_redirects,
        }

    def _serialize_service(self, service: Service) -> dict:
        return {
            "name": service.name,
            "domain": str(service.domain),
            "upstream_host": service.upstream_host,
            "upstream_port": service.upstream_port,
            "upstream_scheme": service.upstream_scheme,
            "skip_tls_verify": service.skip_tls_verify,
            "tls_enabled": service.tls_enabled,
            "https_redirect_enabled": service.https_redirect_enabled,
            "auth_enabled": service.auth_enabled,
            "allowed_ips": service.allowed_ips,
            "blocked_paths": service.blocked_paths,
            "rate_limit_average": service.rate_limit_average,
            "rate_limit_burst": service.rate_limit_burst,
            "custom_headers": service.custom_headers,
            "frame_policy": service.frame_policy,
            "healthcheck_enabled": service.healthcheck_enabled,
            "healthcheck_path": service.healthcheck_path,
            "healthcheck_timeout_ms": service.healthcheck_timeout_ms,
            "healthcheck_expected_statuses": service.healthcheck_expected_statuses,
            "basic_auth_users": service.basic_auth_users,
            "middleware_template_ids": service.middleware_template_ids,
            "authentik_provider_id": service.authentik_provider_id,
            "authentik_app_slug": service.authentik_app_slug,
            "authentik_group_id": service.authentik_group_id,
            "authentik_group_name": service.authentik_group_name,
            "authentik_policy_id": service.authentik_policy_id,
            "authentik_policy_binding_id": service.authentik_policy_binding_id,
            "cloudflare_record_id": service.cloudflare_record_id,
        }

    def _serialize_redirect(self, redirect_host: RedirectHost) -> dict:
        return {
            "domain": str(redirect_host.domain),
            "target_url": redirect_host.target_url,
            "permanent": redirect_host.permanent,
            "tls_enabled": redirect_host.tls_enabled,
        }

    async def _resolve_middleware_templates(self, template_ids: list[str]) -> list[MiddlewareTemplate]:
        if not template_ids:
            return []

        parsed_ids: list[UUID] = []
        for item in template_ids:
            try:
                parsed_ids.append(UUID(item))
            except ValueError as exc:
                raise ValueError(f"유효하지 않은 미들웨어 템플릿 ID입니다: {item}") from exc

        templates = await self.middleware_template_repository.find_many_by_ids(parsed_ids)
        template_map = {str(item.id): item for item in templates}

        resolved: list[MiddlewareTemplate] = []
        for template_id in template_ids:
            template = template_map.get(template_id)
            if not template:
                raise ValueError(f"미들웨어 템플릿을 찾을 수 없습니다: {template_id}")
            resolved.append(template)
        return resolved

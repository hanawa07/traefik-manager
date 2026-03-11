from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.domain.proxy.value_objects.domain_name import DomainName
from app.domain.proxy.value_objects.upstream import Upstream
from app.domain.proxy.value_objects.service_id import ServiceId
from app.infrastructure.persistence.models import ServiceModel


class SQLiteServiceRepository(ServiceRepository):

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, service: Service) -> None:
        existing = await self.db.get(ServiceModel, str(service.id))
        if existing:
            existing.name = service.name
            existing.domain = str(service.domain)
            existing.upstream_host = service.upstream.host
            existing.upstream_port = service.upstream.port
            existing.upstream_scheme = service.upstream_scheme
            existing.skip_tls_verify = service.skip_tls_verify
            existing.tls_enabled = service.tls_enabled
            existing.https_redirect_enabled = service.https_redirect_enabled
            existing.auth_enabled = service.auth_enabled
            existing.auth_mode = service.auth_mode
            existing.api_key = service.api_key
            existing.allowed_ips = service.allowed_ips
            existing.blocked_paths = service.blocked_paths
            existing.rate_limit_average = service.rate_limit_average
            existing.rate_limit_burst = service.rate_limit_burst
            existing.custom_headers = service.custom_headers
            existing.basic_auth_users = service.basic_auth_users
            existing.middleware_template_ids = service.middleware_template_ids
            existing.authentik_provider_id = service.authentik_provider_id
            existing.authentik_app_slug = service.authentik_app_slug
            existing.authentik_group_id = service.authentik_group_id
            existing.authentik_group_name = service.authentik_group_name
            existing.authentik_policy_id = service.authentik_policy_id
            existing.authentik_policy_binding_id = service.authentik_policy_binding_id
            existing.cloudflare_record_id = service.cloudflare_record_id
            existing.frame_policy = service.frame_policy
            existing.healthcheck_enabled = service.healthcheck_enabled
            existing.healthcheck_path = service.healthcheck_path
            existing.healthcheck_timeout_ms = service.healthcheck_timeout_ms
            existing.healthcheck_expected_statuses = service.healthcheck_expected_statuses
        else:
            model = ServiceModel(
                id=str(service.id),
                name=service.name,
                domain=str(service.domain),
                upstream_host=service.upstream.host,
                upstream_port=service.upstream.port,
                upstream_scheme=service.upstream_scheme,
                skip_tls_verify=service.skip_tls_verify,
                tls_enabled=service.tls_enabled,
                https_redirect_enabled=service.https_redirect_enabled,
                auth_enabled=service.auth_enabled,
                auth_mode=service.auth_mode,
                api_key=service.api_key,
                allowed_ips=service.allowed_ips,
                blocked_paths=service.blocked_paths,
                rate_limit_average=service.rate_limit_average,
                rate_limit_burst=service.rate_limit_burst,
                custom_headers=service.custom_headers,
                basic_auth_users=service.basic_auth_users,
                middleware_template_ids=service.middleware_template_ids,
                authentik_provider_id=service.authentik_provider_id,
                authentik_app_slug=service.authentik_app_slug,
                authentik_group_id=service.authentik_group_id,
                authentik_group_name=service.authentik_group_name,
                authentik_policy_id=service.authentik_policy_id,
                authentik_policy_binding_id=service.authentik_policy_binding_id,
                cloudflare_record_id=service.cloudflare_record_id,
                frame_policy=service.frame_policy,
                healthcheck_enabled=service.healthcheck_enabled,
                healthcheck_path=service.healthcheck_path,
                healthcheck_timeout_ms=service.healthcheck_timeout_ms,
                healthcheck_expected_statuses=service.healthcheck_expected_statuses,
            )
            self.db.add(model)

    async def find_by_id(self, service_id: UUID) -> Service | None:
        model = await self.db.get(ServiceModel, str(service_id))
        return self._to_entity(model) if model else None

    async def find_all(self) -> list[Service]:
        result = await self.db.execute(select(ServiceModel))
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_domain(self, domain: str) -> Service | None:
        result = await self.db.execute(
            select(ServiceModel).where(ServiceModel.domain == domain)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def delete(self, service_id: UUID) -> None:
        model = await self.db.get(ServiceModel, str(service_id))
        if model:
            await self.db.delete(model)

    def _to_entity(self, model: ServiceModel) -> Service:
        from uuid import UUID as _UUID
        service = Service(
            id=ServiceId(_UUID(model.id)),
            name=model.name,
            domain=DomainName(model.domain),
            upstream=Upstream(model.upstream_host, model.upstream_port),
            tls_enabled=model.tls_enabled,
            auth_enabled=model.auth_enabled,
            auth_mode=model.auth_mode or "none",
            api_key=model.api_key,
            created_at=model.created_at,
            updated_at=model.updated_at,
            https_redirect_enabled=model.https_redirect_enabled,
            allowed_ips=model.allowed_ips or [],
            blocked_paths=model.blocked_paths or [],
            rate_limit_average=model.rate_limit_average,
            rate_limit_burst=model.rate_limit_burst,
            custom_headers=model.custom_headers or {},
            basic_auth_users=model.basic_auth_users or [],
            middleware_template_ids=model.middleware_template_ids or [],
            authentik_provider_id=model.authentik_provider_id,
            authentik_app_slug=model.authentik_app_slug,
            authentik_group_id=model.authentik_group_id,
            authentik_group_name=model.authentik_group_name,
            authentik_policy_id=model.authentik_policy_id,
            authentik_policy_binding_id=model.authentik_policy_binding_id,
            cloudflare_record_id=model.cloudflare_record_id,
            upstream_scheme=model.upstream_scheme or "http",
            skip_tls_verify=model.skip_tls_verify or False,
            frame_policy=model.frame_policy or "deny",
            healthcheck_enabled=model.healthcheck_enabled,
            healthcheck_path=model.healthcheck_path or "/",
            healthcheck_timeout_ms=model.healthcheck_timeout_ms or 3000,
            healthcheck_expected_statuses=model.healthcheck_expected_statuses or [],
        )
        return service

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
            existing.tls_enabled = service.tls_enabled
            existing.https_redirect_enabled = service.https_redirect_enabled
            existing.auth_enabled = service.auth_enabled
            existing.allowed_ips = service.allowed_ips
            existing.authentik_provider_id = service.authentik_provider_id
            existing.authentik_app_slug = service.authentik_app_slug
            existing.authentik_group_id = service.authentik_group_id
            existing.authentik_group_name = service.authentik_group_name
            existing.authentik_policy_id = service.authentik_policy_id
            existing.authentik_policy_binding_id = service.authentik_policy_binding_id
        else:
            model = ServiceModel(
                id=str(service.id),
                name=service.name,
                domain=str(service.domain),
                upstream_host=service.upstream.host,
                upstream_port=service.upstream.port,
                tls_enabled=service.tls_enabled,
                https_redirect_enabled=service.https_redirect_enabled,
                auth_enabled=service.auth_enabled,
                allowed_ips=service.allowed_ips,
                authentik_provider_id=service.authentik_provider_id,
                authentik_app_slug=service.authentik_app_slug,
                authentik_group_id=service.authentik_group_id,
                authentik_group_name=service.authentik_group_name,
                authentik_policy_id=service.authentik_policy_id,
                authentik_policy_binding_id=service.authentik_policy_binding_id,
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
            created_at=model.created_at,
            updated_at=model.updated_at,
            https_redirect_enabled=model.https_redirect_enabled,
            allowed_ips=model.allowed_ips or [],
            authentik_provider_id=model.authentik_provider_id,
            authentik_app_slug=model.authentik_app_slug,
            authentik_group_id=model.authentik_group_id,
            authentik_group_name=model.authentik_group_name,
            authentik_policy_id=model.authentik_policy_id,
            authentik_policy_binding_id=model.authentik_policy_binding_id,
        )
        return service

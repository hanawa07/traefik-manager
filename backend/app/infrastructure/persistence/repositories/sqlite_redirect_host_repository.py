from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.proxy.entities.redirect_host import RedirectHost
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.value_objects.domain_name import DomainName
from app.infrastructure.persistence.models import RedirectHostModel


class SQLiteRedirectHostRepository(RedirectHostRepository):

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, redirect_host: RedirectHost) -> None:
        existing = await self.db.get(RedirectHostModel, str(redirect_host.id))
        if existing:
            existing.domain = str(redirect_host.domain)
            existing.target_url = redirect_host.target_url
            existing.permanent = redirect_host.permanent
            existing.tls_enabled = redirect_host.tls_enabled
        else:
            model = RedirectHostModel(
                id=str(redirect_host.id),
                domain=str(redirect_host.domain),
                target_url=redirect_host.target_url,
                permanent=redirect_host.permanent,
                tls_enabled=redirect_host.tls_enabled,
            )
            self.db.add(model)

    async def find_by_id(self, redirect_id: UUID) -> RedirectHost | None:
        model = await self.db.get(RedirectHostModel, str(redirect_id))
        return self._to_entity(model) if model else None

    async def find_all(self) -> list[RedirectHost]:
        result = await self.db.execute(select(RedirectHostModel))
        return [self._to_entity(model) for model in result.scalars().all()]

    async def find_by_domain(self, domain: str) -> RedirectHost | None:
        result = await self.db.execute(
            select(RedirectHostModel).where(RedirectHostModel.domain == domain)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def delete(self, redirect_id: UUID) -> None:
        model = await self.db.get(RedirectHostModel, str(redirect_id))
        if model:
            await self.db.delete(model)

    def _to_entity(self, model: RedirectHostModel) -> RedirectHost:
        from uuid import UUID as _UUID

        return RedirectHost(
            id=_UUID(model.id),
            domain=DomainName(model.domain),
            target_url=model.target_url,
            permanent=model.permanent,
            tls_enabled=model.tls_enabled,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.infrastructure.persistence.models import MiddlewareTemplateModel


class SQLiteMiddlewareTemplateRepository(MiddlewareTemplateRepository):

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, template: MiddlewareTemplate) -> None:
        existing = await self.db.get(MiddlewareTemplateModel, str(template.id))
        if existing:
            existing.name = template.name
            existing.type = template.type
            existing.config = template.config
        else:
            model = MiddlewareTemplateModel(
                id=str(template.id),
                name=template.name,
                type=template.type,
                config=template.config,
            )
            self.db.add(model)

    async def find_by_id(self, template_id: UUID) -> MiddlewareTemplate | None:
        model = await self.db.get(MiddlewareTemplateModel, str(template_id))
        return self._to_entity(model) if model else None

    async def find_all(self) -> list[MiddlewareTemplate]:
        result = await self.db.execute(select(MiddlewareTemplateModel))
        return [self._to_entity(item) for item in result.scalars().all()]

    async def find_many_by_ids(self, template_ids: list[UUID]) -> list[MiddlewareTemplate]:
        if not template_ids:
            return []
        id_values = [str(item) for item in template_ids]
        result = await self.db.execute(
            select(MiddlewareTemplateModel).where(MiddlewareTemplateModel.id.in_(id_values))
        )
        return [self._to_entity(item) for item in result.scalars().all()]

    async def delete(self, template_id: UUID) -> None:
        model = await self.db.get(MiddlewareTemplateModel, str(template_id))
        if model:
            await self.db.delete(model)

    def _to_entity(self, model: MiddlewareTemplateModel) -> MiddlewareTemplate:
        from uuid import UUID as _UUID

        return MiddlewareTemplate(
            id=_UUID(model.id),
            name=model.name,
            type=model.type,
            config=model.config or {},
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

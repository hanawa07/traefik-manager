from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.service_repository import ServiceRepository


class MiddlewareTemplateUseCases:

    def __init__(
        self,
        repository: MiddlewareTemplateRepository,
        service_repository: ServiceRepository,
    ):
        self.repository = repository
        self.service_repository = service_repository

    async def list_templates(self) -> list[MiddlewareTemplate]:
        return await self.repository.find_all()

    async def get_template(self, template_id: UUID) -> MiddlewareTemplate | None:
        return await self.repository.find_by_id(template_id)

    async def create_template(self, data) -> MiddlewareTemplate:
        template = MiddlewareTemplate.create(
            name=data.name,
            type=data.type,
            config=data.config,
        )
        await self.repository.save(template)
        return template

    async def update_template(self, template_id: UUID, data) -> MiddlewareTemplate | None:
        template = await self.repository.find_by_id(template_id)
        if not template:
            return None

        update_payload = data.model_dump(exclude_unset=True)
        template.update(
            name=update_payload.get("name"),
            type=update_payload.get("type"),
            config=update_payload.get("config"),
        )
        await self.repository.save(template)
        return template

    async def delete_template(self, template_id: UUID) -> None:
        await self._validate_not_used(template_id)
        await self.repository.delete(template_id)

    async def _validate_not_used(self, template_id: UUID) -> None:
        services = await self.service_repository.find_all()
        template_id_str = str(template_id)
        for service in services:
            if template_id_str in service.middleware_template_ids:
                raise ValueError("해당 템플릿을 사용하는 서비스가 있어 삭제할 수 없습니다")

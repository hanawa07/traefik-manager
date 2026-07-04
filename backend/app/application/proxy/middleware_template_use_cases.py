from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.service_repository import ServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


class MiddlewareTemplateUseCases:

    def __init__(
        self,
        repository: MiddlewareTemplateRepository,
        service_repository: ServiceRepository,
        file_writer: FileProviderWriter,
    ):
        self.repository = repository
        self.service_repository = service_repository
        self.file_writer = file_writer

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
        await self._sync_shared_templates()
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
        affected_services = await self._find_services_using_template(template_id)
        self._validate_auth_conflicts(template, affected_services)
        await self.repository.save(template)
        await self._sync_shared_templates()
        await self._rewrite_services(affected_services)
        return template

    async def delete_template(self, template_id: UUID) -> None:
        await self._validate_not_used(template_id)
        await self.repository.delete(template_id)
        await self._sync_shared_templates()

    async def _validate_not_used(self, template_id: UUID) -> None:
        services = await self._find_services_using_template(template_id)
        if services:
            raise ValueError("해당 템플릿을 사용하는 서비스가 있어 삭제할 수 없습니다")

    async def _find_services_using_template(self, template_id: UUID):
        services = await self.service_repository.find_all()
        template_id_str = str(template_id)
        return [
            service
            for service in services
            if template_id_str in service.middleware_template_ids
        ]

    def _validate_auth_conflicts(
        self,
        template: MiddlewareTemplate,
        services,
    ) -> None:
        if template.type != "basicAuth":
            return

        conflicted_services = [service.name for service in services if service.auth_enabled]
        if conflicted_services:
            joined = ", ".join(conflicted_services[:3])
            if len(conflicted_services) > 3:
                joined = f"{joined} 외 {len(conflicted_services) - 3}개"
            raise ValueError(
                f"인증 모드를 쓰는 서비스에는 BasicAuth 템플릿을 적용할 수 없습니다: {joined}"
            )

    async def _rewrite_services(self, services) -> None:
        for service in services:
            middleware_templates = await self._resolve_templates(service.middleware_template_ids)
            self.file_writer.write(service, middleware_templates=middleware_templates)

    async def _sync_shared_templates(self) -> None:
        self.file_writer.write_shared_middleware_templates(await self.repository.find_all())

    async def _resolve_templates(self, template_ids: list[str]) -> list[MiddlewareTemplate]:
        if not template_ids:
            return []

        parsed_ids = [UUID(item) for item in template_ids]
        templates = await self.repository.find_many_by_ids(parsed_ids)
        template_map = {str(template.id): template for template in templates}

        resolved: list[MiddlewareTemplate] = []
        for template_id in template_ids:
            template = template_map.get(template_id)
            if template is not None:
                resolved.append(template)
        return resolved

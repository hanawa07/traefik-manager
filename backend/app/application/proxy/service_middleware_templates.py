from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)


class ServiceMiddlewareTemplateResolver:
    def __init__(self, repository: MiddlewareTemplateRepository):
        self.repository = repository

    async def resolve(self, template_ids: list[str]) -> list[MiddlewareTemplate]:
        if not template_ids:
            return []

        parsed_ids = self._parse_template_ids(template_ids)
        templates = await self.repository.find_many_by_ids(parsed_ids)
        template_map = {str(item.id): item for item in templates}

        resolved: list[MiddlewareTemplate] = []
        for template_id in template_ids:
            template = template_map.get(template_id)
            if not template:
                raise ValueError(f"미들웨어 템플릿을 찾을 수 없습니다: {template_id}")
            resolved.append(template)
        return resolved

    async def list_all(self) -> list[MiddlewareTemplate]:
        return await self.repository.find_all()

    def validate_auth_conflict(
        self,
        service: Service,
        templates: list[MiddlewareTemplate],
    ) -> None:
        if not service.auth_enabled:
            return
        if any(template.type == "basicAuth" for template in templates):
            raise ValueError("인증 모드와 BasicAuth 미들웨어 템플릿은 동시에 사용할 수 없습니다")

    def _parse_template_ids(self, template_ids: list[str]) -> list[UUID]:
        parsed_ids: list[UUID] = []
        for item in template_ids:
            try:
                parsed_ids.append(UUID(item))
            except ValueError as exc:
                raise ValueError(f"유효하지 않은 미들웨어 템플릿 ID입니다: {item}") from exc
        return parsed_ids

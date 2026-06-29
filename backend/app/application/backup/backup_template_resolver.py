from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)


async def resolve_middleware_templates(
    repository: MiddlewareTemplateRepository,
    template_ids: list[str],
) -> list[MiddlewareTemplate]:
    if not template_ids:
        return []

    parsed_ids: list[UUID] = []
    for item in template_ids:
        try:
            parsed_ids.append(UUID(item))
        except ValueError as exc:
            raise ValueError(f"유효하지 않은 미들웨어 템플릿 ID입니다: {item}") from exc

    templates = await repository.find_many_by_ids(parsed_ids)
    template_map = {str(item.id): item for item in templates}

    resolved: list[MiddlewareTemplate] = []
    for template_id in template_ids:
        template = template_map.get(template_id)
        if not template:
            raise ValueError(f"미들웨어 템플릿을 찾을 수 없습니다: {template_id}")
        resolved.append(template)
    return resolved

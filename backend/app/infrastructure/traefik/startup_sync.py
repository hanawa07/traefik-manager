import logging
from uuid import UUID

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service

logger = logging.getLogger(__name__)


async def sync_existing_service_configs(
    service_repository,
    middleware_template_repository,
    file_writer,
) -> int:
    services = await service_repository.find_all()
    rewritten = 0

    for service in services:
        try:
            templates = await _resolve_middleware_templates(
                service=service,
                middleware_template_repository=middleware_template_repository,
            )
            file_writer.write(service, middleware_templates=templates)
            rewritten += 1
        except Exception:
            logger.warning(
                "서비스 라우트 파일 startup 재생성 실패",
                extra={
                    "service_id": str(service.id),
                    "domain": str(service.domain),
                },
                exc_info=True,
            )

    return rewritten


async def _resolve_middleware_templates(
    service: Service,
    middleware_template_repository,
) -> list[MiddlewareTemplate]:
    if not service.middleware_template_ids:
        return []

    template_ids = [UUID(item) for item in service.middleware_template_ids]
    templates = await middleware_template_repository.find_many_by_ids(template_ids)
    template_map = {str(item.id): item for item in templates}

    resolved: list[MiddlewareTemplate] = []
    for template_id in service.middleware_template_ids:
        template = template_map.get(template_id)
        if template is None:
            raise ValueError(f"미들웨어 템플릿을 찾을 수 없습니다: {template_id}")
        resolved.append(template)

    return resolved

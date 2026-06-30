from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.middlewares_rollback_action import (
    rollback_template_change_action,
)
from app.interfaces.api.v1.schemas.middleware_schemas import MiddlewareTemplateResponse


@dataclass(frozen=True)
class MiddlewareRollbackEndpoints:
    rollback_template_change: Callable[..., Any]


def register_middleware_rollback_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., MiddlewareTemplateUseCases],
    write_access_dependency: Callable[..., Any],
    audit_service_provider: Callable[[], Any],
) -> MiddlewareRollbackEndpoints:
    @router.post(
        "/rollback/{audit_log_id}",
        response_model=MiddlewareTemplateResponse,
        summary="미들웨어 템플릿 변경 롤백",
    )
    async def rollback_template_change(
        audit_log_id: str,
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        return await rollback_template_change_action(
            audit_log_id=audit_log_id,
            use_cases=use_cases,
            db=db,
            current_user=current_user,
            audit_service=audit_service_provider(),
        )

    return MiddlewareRollbackEndpoints(rollback_template_change=rollback_template_change)

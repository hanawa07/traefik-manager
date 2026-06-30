from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.interfaces.api.v1.schemas.middleware_schemas import MiddlewareTemplateResponse


@dataclass(frozen=True)
class MiddlewareReadEndpoints:
    list_templates: Callable[..., Any]
    get_template: Callable[..., Any]


def register_middleware_read_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., MiddlewareTemplateUseCases],
    current_user_dependency: Callable[..., Any],
) -> MiddlewareReadEndpoints:
    @router.get(
        "",
        response_model=list[MiddlewareTemplateResponse],
        summary="미들웨어 템플릿 목록",
    )
    async def list_templates(
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        _: dict = Depends(current_user_dependency),
    ):
        return await use_cases.list_templates()

    @router.get(
        "/{template_id}",
        response_model=MiddlewareTemplateResponse,
        summary="미들웨어 템플릿 조회",
    )
    async def get_template(
        template_id: UUID,
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        _: dict = Depends(current_user_dependency),
    ):
        template = await use_cases.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="미들웨어 템플릿을 찾을 수 없습니다",
            )
        return template

    return MiddlewareReadEndpoints(
        list_templates=list_templates,
        get_template=get_template,
    )

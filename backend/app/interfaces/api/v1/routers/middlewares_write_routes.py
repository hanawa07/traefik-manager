from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.v1.routers.middlewares_audit_helpers import (
    MIDDLEWARE_CREATE_EVENT,
    MIDDLEWARE_DELETE_EVENT,
    MIDDLEWARE_UPDATE_EVENT,
    build_middleware_rollback_payload,
    changed_middleware_keys,
    middleware_audit_summary,
)
from app.interfaces.api.v1.schemas.middleware_schemas import (
    MiddlewareTemplateCreate,
    MiddlewareTemplateResponse,
    MiddlewareTemplateUpdate,
)


@dataclass(frozen=True)
class MiddlewareWriteEndpoints:
    create_template: Callable[..., Any]
    update_template: Callable[..., Any]
    delete_template: Callable[..., Any]


def register_middleware_write_routes(
    router: APIRouter,
    *,
    get_use_cases: Callable[..., MiddlewareTemplateUseCases],
    write_access_dependency: Callable[..., Any],
    audit_service_provider: Callable[[], Any],
) -> MiddlewareWriteEndpoints:
    @router.post(
        "",
        response_model=MiddlewareTemplateResponse,
        status_code=status.HTTP_201_CREATED,
        summary="미들웨어 템플릿 추가",
    )
    async def create_template(
        data: MiddlewareTemplateCreate,
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        try:
            template = await use_cases.create_template(data)
            await audit_service_provider().record(
                db=db,
                actor=current_user["username"],
                action="create",
                resource_type="middleware",
                resource_id=str(template.id),
                resource_name=template.name,
                detail={
                    "event": MIDDLEWARE_CREATE_EVENT,
                    "type": template.type,
                },
            )
            return template
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    @router.put(
        "/{template_id}",
        response_model=MiddlewareTemplateResponse,
        summary="미들웨어 템플릿 수정",
    )
    async def update_template(
        template_id: UUID,
        data: MiddlewareTemplateUpdate,
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        try:
            before_template = await use_cases.get_template(template_id)
            template = await use_cases.update_template(template_id, data)
            if template and before_template:
                before_summary = middleware_audit_summary(before_template)
                after_summary = middleware_audit_summary(template)
                changed_keys = changed_middleware_keys(before_summary, after_summary)
                await audit_service_provider().record(
                    db=db,
                    actor=current_user["username"],
                    action="update",
                    resource_type="middleware",
                    resource_id=str(template.id),
                    resource_name=template.name,
                    detail={
                        "event": MIDDLEWARE_UPDATE_EVENT,
                        "changed_keys": changed_keys,
                        "before": before_summary,
                        "after": after_summary,
                        "summary": after_summary,
                        "rollback_supported": True,
                        "rollback_payload": build_middleware_rollback_payload(
                            before_summary,
                            changed_keys,
                        ),
                    },
                )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="미들웨어 템플릿을  찾을 수 없습니다",
            )
        return template

    @router.delete(
        "/{template_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="미들웨어 템플릿 삭제",
    )
    async def delete_template(
        template_id: UUID,
        use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(write_access_dependency),
    ):
        template = await use_cases.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="미들웨어 템플릿을 찾을 수 없습니다",
            )

        try:
            await use_cases.delete_template(template_id)
            await audit_service_provider().record(
                db=db,
                actor=current_user["username"],
                action="delete",
                resource_type="middleware",
                resource_id=str(template_id),
                resource_name=template.name,
                detail={
                    "event": MIDDLEWARE_DELETE_EVENT,
                    "type": template.type,
                },
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return MiddlewareWriteEndpoints(
        create_template=create_template,
        update_template=update_template,
        delete_template=delete_template,
    )

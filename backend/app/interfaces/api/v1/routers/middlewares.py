from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.interfaces.api.v1.routers.middlewares_audit_helpers import (
    MIDDLEWARE_CREATE_EVENT,
    MIDDLEWARE_DELETE_EVENT,
    MIDDLEWARE_UPDATE_EVENT,
    build_middleware_rollback_payload,
    changed_middleware_keys,
    middleware_audit_summary,
)
from app.interfaces.api.v1.routers.middlewares_rollback_action import rollback_template_change_action
from app.interfaces.api.v1.schemas.middleware_schemas import (
    MiddlewareTemplateCreate,
    MiddlewareTemplateResponse,
    MiddlewareTemplateUpdate,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> MiddlewareTemplateUseCases:
    return MiddlewareTemplateUseCases(
        repository=SQLiteMiddlewareTemplateRepository(db),
        service_repository=SQLiteServiceRepository(db),
        file_writer=FileProviderWriter(),
    )


@router.get("", response_model=list[MiddlewareTemplateResponse], summary="미들웨어 템플릿 목록")
async def list_templates(
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    return await use_cases.list_templates()


@router.post("", response_model=MiddlewareTemplateResponse, status_code=status.HTTP_201_CREATED, summary="미들웨어 템플릿 추가")
async def create_template(
    data: MiddlewareTemplateCreate,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    try:
        template = await use_cases.create_template(data)
        await audit_service.record(
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{template_id}", response_model=MiddlewareTemplateResponse, summary="미들웨어 템플릿 조회")
async def get_template(
    template_id: UUID,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    _: dict = Depends(get_current_user),
):
    template = await use_cases.get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")
    return template


@router.put("/{template_id}", response_model=MiddlewareTemplateResponse, summary="미들웨어 템플릿 수정")
async def update_template(
    template_id: UUID,
    data: MiddlewareTemplateUpdate,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    try:
        before_template = await use_cases.get_template(template_id)
        template = await use_cases.update_template(template_id, data)
        if template and before_template:
            before_summary = middleware_audit_summary(before_template)
            after_summary = middleware_audit_summary(template)
            changed_keys = changed_middleware_keys(before_summary, after_summary)
            await audit_service.record(
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
                    "rollback_payload": build_middleware_rollback_payload(before_summary, changed_keys),
                },
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을  찾을 수 없습니다")
    return template


@router.post(
    "/rollback/{audit_log_id}",
    response_model=MiddlewareTemplateResponse,
    summary="미들웨어 템플릿 변경 롤백",
)
async def rollback_template_change(
    audit_log_id: str,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    return await rollback_template_change_action(
        audit_log_id=audit_log_id,
        use_cases=use_cases,
        db=db,
        current_user=current_user,
        audit_service=audit_service,
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="미들웨어 템플릿 삭제")
async def delete_template(
    template_id: UUID,
    use_cases: MiddlewareTemplateUseCases = Depends(get_use_cases),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_write_access),
):
    template = await use_cases.get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")

    try:
        await use_cases.delete_template(template_id)
        await audit_service.record(
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

from copy import deepcopy
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_middleware_template_repository import (
    SQLiteMiddlewareTemplateRepository,
)
from app.infrastructure.persistence.repositories.sqlite_service_repository import (
    SQLiteServiceRepository,
)
from app.interfaces.api.dependencies import get_current_user, require_write_access
from app.application.audit import audit_service
from app.interfaces.api.v1.schemas.middleware_schemas import (
    MiddlewareTemplateCreate,
    MiddlewareTemplateResponse,
    MiddlewareTemplateUpdate,
)

router = APIRouter()
MIDDLEWARE_CREATE_EVENT = "middleware_create"
MIDDLEWARE_UPDATE_EVENT = "middleware_update"
MIDDLEWARE_DELETE_EVENT = "middleware_delete"
MIDDLEWARE_ROLLBACK_EVENT = "middleware_rollback"


def get_use_cases(db: AsyncSession = Depends(get_db)) -> MiddlewareTemplateUseCases:
    return MiddlewareTemplateUseCases(
        repository=SQLiteMiddlewareTemplateRepository(db),
        service_repository=SQLiteServiceRepository(db),
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
            before_summary = _middleware_audit_summary(before_template)
            after_summary = _middleware_audit_summary(template)
            changed_keys = sorted(
                [
                    key
                    for key in set(before_summary.keys()) | set(after_summary.keys())
                    if before_summary.get(key) != after_summary.get(key)
                ]
            )
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
                    "rollback_payload": _build_middleware_rollback_payload(before_summary, changed_keys),
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
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 미들웨어 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "middleware" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="미들웨어 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != MIDDLEWARE_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 미들웨어 변경은 안전 롤백을 지원하지 않습니다")

    current_template = await use_cases.get_template(UUID(audit_log.resource_id))
    if current_template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")

    before_summary = _middleware_audit_summary(current_template)
    updated_template = await use_cases.update_template(UUID(audit_log.resource_id), MiddlewareTemplateUpdate(**rollback_payload))
    if updated_template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")

    after_summary = _middleware_audit_summary(updated_template)
    changed_keys = sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="middleware",
        resource_id=str(updated_template.id),
        resource_name=updated_template.name,
        detail={
            "event": MIDDLEWARE_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_template



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


def _middleware_audit_summary(template) -> dict[str, object]:
    return {
        "name": getattr(template, "name", ""),
        "type": getattr(template, "type", ""),
        "config": deepcopy(getattr(template, "config", {})),
    }


def _build_middleware_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
) -> dict[str, object]:
    return {key: deepcopy(before_summary[key]) for key in changed_keys if key in before_summary}

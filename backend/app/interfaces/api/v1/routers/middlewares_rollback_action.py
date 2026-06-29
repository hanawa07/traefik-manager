from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.middlewares_audit_helpers import (
    MIDDLEWARE_ROLLBACK_EVENT,
    MIDDLEWARE_UPDATE_EVENT,
    changed_middleware_keys,
    middleware_audit_summary,
)
from app.interfaces.api.v1.schemas.middleware_schemas import MiddlewareTemplateUpdate


async def rollback_template_change_action(
    *,
    audit_log_id: str,
    use_cases: MiddlewareTemplateUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    audit_log = await _get_middleware_update_audit_log(db, audit_log_id)
    rollback_payload = _get_supported_middleware_rollback_payload(audit_log)

    current_template = await use_cases.get_template(UUID(audit_log.resource_id))
    if current_template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")

    before_summary = middleware_audit_summary(current_template)
    updated_template = await use_cases.update_template(
        UUID(audit_log.resource_id),
        MiddlewareTemplateUpdate(**rollback_payload),
    )
    if updated_template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="미들웨어 템플릿을 찾을 수 없습니다")

    after_summary = middleware_audit_summary(updated_template)
    changed_keys = changed_middleware_keys(before_summary, after_summary)
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


async def _get_middleware_update_audit_log(db: AsyncSession, audit_log_id: str):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 미들웨어 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "middleware" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="미들웨어 변경 로그만 롤백할 수 있습니다")
    return audit_log


def _get_supported_middleware_rollback_payload(audit_log) -> dict:
    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != MIDDLEWARE_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 미들웨어 변경은 안전 롤백을 지원하지 않습니다")
    return rollback_payload

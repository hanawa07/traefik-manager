from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.redirect_host_use_cases import RedirectHostUseCases
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.redirects_audit_helpers import (
    REDIRECT_ROLLBACK_EVENT,
    REDIRECT_UPDATE_EVENT,
    changed_redirect_keys,
    redirect_audit_summary,
)
from app.interfaces.api.v1.schemas.redirect_schemas import RedirectHostUpdate


async def rollback_redirect_change_action(
    *,
    audit_log_id: str,
    use_cases: RedirectHostUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    audit_log = await _get_redirect_update_audit_log(db, audit_log_id)
    rollback_payload = _get_supported_redirect_rollback_payload(audit_log)

    current_redirect = await use_cases.get_redirect_host(UUID(audit_log.resource_id))
    if current_redirect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")

    before_summary = redirect_audit_summary(current_redirect)
    updated_redirect = await use_cases.update_redirect_host(
        UUID(audit_log.resource_id),
        RedirectHostUpdate(**rollback_payload),
    )
    if updated_redirect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="리다이렉트를 찾을 수 없습니다")

    after_summary = redirect_audit_summary(updated_redirect)
    changed_keys = changed_redirect_keys(before_summary, after_summary)
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="redirect",
        resource_id=str(updated_redirect.id),
        resource_name=str(updated_redirect.domain),
        detail={
            "event": REDIRECT_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_redirect


async def _get_redirect_update_audit_log(db: AsyncSession, audit_log_id: str):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 리다이렉트 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "redirect" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="리다이렉트 변경 로그만 롤백할 수 있습니다")
    return audit_log


def _get_supported_redirect_rollback_payload(audit_log) -> dict:
    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != REDIRECT_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 리다이렉트 변경은 안전 롤백을 지원하지 않습니다")
    return rollback_payload

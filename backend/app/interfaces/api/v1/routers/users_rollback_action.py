from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.user_use_cases import UserUseCases
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.users_audit_helpers import (
    USER_ROLLBACK_EVENT,
    USER_UPDATE_EVENT,
    changed_user_keys,
    user_audit_summary,
)
from app.interfaces.api.v1.routers.users_lookup_helpers import get_user_for_update
from app.interfaces.api.v1.schemas.user_schemas import UserUpdate


async def rollback_user_change_action(
    *,
    audit_log_id: str,
    use_cases: UserUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    audit_log = await _get_user_update_audit_log(db, audit_log_id)
    rollback_payload = _get_supported_user_rollback_payload(audit_log)

    current_user_entity = await get_user_for_update(use_cases, UUID(audit_log.resource_id))
    if current_user_entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    before_summary = user_audit_summary(current_user_entity, password_changed=False)
    updated_user = await use_cases.update_user(UUID(audit_log.resource_id), UserUpdate(**rollback_payload))
    if updated_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    after_summary = user_audit_summary(updated_user, password_changed=False)
    changed_keys = changed_user_keys(before_summary, after_summary)
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="user",
        resource_id=str(updated_user.id),
        resource_name=updated_user.username,
        detail={
            "event": USER_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_user


async def _get_user_update_audit_log(db: AsyncSession, audit_log_id: str):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 사용자 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "user" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="사용자 변경 로그만 롤백할 수 있습니다")
    return audit_log


def _get_supported_user_rollback_payload(audit_log) -> dict:
    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != USER_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 사용자 변경은 안전 롤백을 지원하지 않습니다")
    return rollback_payload

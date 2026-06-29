from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.proxy.service_use_cases import ServiceUseCases
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.v1.routers.services_audit_helpers import (
    SERVICE_ROLLBACK_EVENT,
    SERVICE_UPDATE_EVENT,
    changed_service_keys,
    service_audit_summary,
    service_resource_id,
)
from app.interfaces.api.v1.schemas.service_schemas import ServiceUpdate


async def rollback_service_change_action(
    *,
    audit_log_id: str,
    use_cases: ServiceUseCases,
    db: AsyncSession,
    current_user: dict,
    audit_service,
):
    audit_log = await _get_service_update_audit_log(db, audit_log_id)
    rollback_payload = _get_supported_rollback_payload(audit_log)

    current_service = await use_cases.get_service(UUID(audit_log.resource_id))
    if current_service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    before_summary = service_audit_summary(current_service)
    updated_service = await use_cases.update_service(UUID(audit_log.resource_id), ServiceUpdate(**rollback_payload))
    if updated_service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    after_summary = service_audit_summary(updated_service)
    changed_keys = changed_service_keys(before_summary, after_summary)
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="rollback",
        resource_type="service",
        resource_id=service_resource_id(updated_service),
        resource_name=updated_service.name,
        detail={
            "event": SERVICE_ROLLBACK_EVENT,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_summary,
            "after": after_summary,
            "summary": after_summary,
        },
    )
    return updated_service


async def _get_service_update_audit_log(db: AsyncSession, audit_log_id: str):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 서비스 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "service" or audit_log.action != "update":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="서비스 변경 로그만 롤백할 수 있습니다")
    return audit_log


def _get_supported_rollback_payload(audit_log) -> dict:
    detail = audit_log.detail or {}
    rollback_payload = detail.get("rollback_payload")
    if (
        detail.get("event") != SERVICE_UPDATE_EVENT
        or detail.get("rollback_supported") is not True
        or not isinstance(rollback_payload, dict)
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="이 서비스 변경은 안전 롤백을 지원하지 않습니다")
    return rollback_payload

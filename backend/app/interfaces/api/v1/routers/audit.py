from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.audit_certificate_summary import build_certificate_summary
from app.interfaces.api.v1.routers.audit_log_filters import filter_audit_logs
from app.interfaces.api.v1.routers.audit_log_helpers import to_audit_log_response
from app.interfaces.api.v1.routers.audit_manager_health_summary import build_manager_health_summary
from app.interfaces.api.v1.routers.audit_security_summary import build_security_summary
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditCertificateSummaryResponse,
    AuditDeliveryRetryResponse,
    AuditLogResponse,
    AuditManagerHealthSummaryResponse,
    AuditSecuritySummaryResponse,
)

router = APIRouter()


@router.get("", response_model=list[AuditLogResponse], summary="감사 로그 조회")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    resource_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    manager_status: Optional[Literal["unhealthy", "recovered"]] = Query(None),
    manager_source: Optional[Literal["docker", "watchdog"]] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    security_only: bool = Query(False),
    provider: Optional[str] = Query(None),
    delivery_success: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """
    시스템 변경 이력(감사 로그)을 최신순으로 조회합니다.
    """
    query = select(AuditLogModel).order_by(desc(AuditLogModel.created_at))

    if resource_type:
        query = query.where(AuditLogModel.resource_type == resource_type)

    result = await db.execute(query)
    logs = result.scalars().all()

    filtered_logs = filter_audit_logs(
        logs,
        resource_type=resource_type,
        action=action,
        event=event,
        manager_status=manager_status,
        manager_source=manager_source,
        search=search,
        security_only=security_only,
        provider=provider,
        delivery_success=delivery_success,
    )
    paged_logs = filtered_logs[offset : offset + limit]
    return [to_audit_log_response(log) for log in paged_logs]


@router.get(
    "/manager-health-summary",
    response_model=AuditManagerHealthSummaryResponse,
    summary="Manager 상태 이벤트 요약",
)
async def get_manager_health_summary(
    window_minutes: int = Query(10080, ge=60, le=525600),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(AuditLogModel).order_by(desc(AuditLogModel.created_at)))
    return build_manager_health_summary(
        logs=result.scalars().all(),
        window_minutes=window_minutes,
        now=datetime.now(timezone.utc),
    )


@router.get("/security-summary", response_model=AuditSecuritySummaryResponse, summary="보안 이벤트 요약")
async def get_security_summary(
    window_minutes: int = Query(1440, ge=1, le=10080),
    recent_limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(AuditLogModel).order_by(desc(AuditLogModel.created_at)))
    logs = result.scalars().all()
    return build_security_summary(
        logs=logs,
        window_minutes=window_minutes,
        recent_limit=recent_limit,
        now=datetime.now(timezone.utc),
    )


@router.get("/certificate-summary", response_model=AuditCertificateSummaryResponse, summary="인증서 경고 요약")
async def get_certificate_summary(
    window_minutes: int = Query(43200, ge=1, le=525600),
    recent_limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(AuditLogModel).order_by(desc(AuditLogModel.created_at)))
    logs = result.scalars().all()
    return build_certificate_summary(
        logs=logs,
        window_minutes=window_minutes,
        recent_limit=recent_limit,
        now=datetime.now(timezone.utc),
    )


@router.post(
    "/retry-delivery/{audit_log_id}",
    response_model=AuditDeliveryRetryResponse,
    summary="알림 전송 실패 재시도",
)
async def retry_delivery(
    audit_log_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalars().first()
    if audit_log is None:
        raise HTTPException(status_code=404, detail="대상 알림 전송 로그를 찾을 수 없습니다")

    try:
        retry_result = await security_alert_notifier.retry_delivery(db, audit_log)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return AuditDeliveryRetryResponse(**retry_result)

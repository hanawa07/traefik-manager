from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.audit_schemas import (
    AuditCertificateEventResponse,
    AuditCertificateSummaryResponse,
    AuditLogResponse,
    AuditSecurityEventResponse,
    AuditSecuritySummaryResponse,
)

router = APIRouter()
SECURITY_EVENTS = {"login_failure", "login_locked", "login_suspicious", "login_blocked_ip"}
SECURITY_ALERT_EVENTS = {"login_locked", "login_suspicious", "login_blocked_ip"}
CERTIFICATE_ALERT_EVENTS = {"certificate_warning", "certificate_error"}


@router.get("", response_model=list[AuditLogResponse], summary="감사 로그 조회")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    resource_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    security_only: bool = Query(False),
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

    filtered_logs = _filter_logs(
        logs,
        resource_type=resource_type,
        action=action,
        event=event,
        security_only=security_only,
    )
    paged_logs = filtered_logs[offset : offset + limit]
    return [_to_audit_log_response(log) for log in paged_logs]


@router.get("/security-summary", response_model=AuditSecuritySummaryResponse, summary="보안 이벤트 요약")
async def get_security_summary(
    window_minutes: int = Query(1440, ge=1, le=10080),
    recent_limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    result = await db.execute(select(AuditLogModel).order_by(desc(AuditLogModel.created_at)))
    logs = result.scalars().all()
    recent_logs = sorted(
        [log for log in logs if log.created_at >= cutoff],
        key=lambda log: log.created_at,
        reverse=True,
    )

    failed_logs = [log for log in recent_logs if _get_event(log) == "login_failure"]
    locked_logs = [log for log in recent_logs if _get_event(log) == "login_locked"]
    suspicious_logs = [log for log in recent_logs if _get_event(log) == "login_suspicious"]
    blocked_logs = [log for log in recent_logs if _get_event(log) == "login_blocked_ip"]
    recent_events = [
        AuditSecurityEventResponse(
            id=log.id,
            event=_get_event(log) or "unknown",
            actor=log.actor,
            resource_name=log.resource_name,
            client_ip=(log.detail or {}).get("client_ip"),
            created_at=log.created_at,
        )
        for log in recent_logs
        if _get_event(log) in SECURITY_ALERT_EVENTS
    ][:recent_limit]

    return AuditSecuritySummaryResponse(
        window_minutes=window_minutes,
        failed_login_count=len(failed_logs),
        locked_login_count=len(locked_logs),
        suspicious_ip_count=len(suspicious_logs),
        blocked_ip_count=len(blocked_logs),
        recent_events=recent_events,
    )


@router.get("/certificate-summary", response_model=AuditCertificateSummaryResponse, summary="인증서 경고 요약")
async def get_certificate_summary(
    window_minutes: int = Query(43200, ge=1, le=525600),
    recent_limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    result = await db.execute(select(AuditLogModel).order_by(desc(AuditLogModel.created_at)))
    logs = result.scalars().all()
    recent_logs = sorted(
        [
            log
            for log in logs
            if log.created_at >= cutoff and _get_event(log) in CERTIFICATE_ALERT_EVENTS
        ],
        key=lambda log: log.created_at,
        reverse=True,
    )

    warning_logs = [log for log in recent_logs if _get_event(log) == "certificate_warning"]
    error_logs = [log for log in recent_logs if _get_event(log) == "certificate_error"]
    recent_events = [
        AuditCertificateEventResponse(
            id=log.id,
            event=_get_event(log) or "unknown",
            actor=log.actor,
            resource_name=log.resource_name,
            days_remaining=_get_detail_int(log, "days_remaining"),
            expires_at=_get_detail_str(log, "expires_at"),
            created_at=log.created_at,
        )
        for log in recent_logs[:recent_limit]
    ]

    return AuditCertificateSummaryResponse(
        window_minutes=window_minutes,
        warning_count=len(warning_logs),
        error_count=len(error_logs),
        recent_events=recent_events,
    )


def _get_event(log: AuditLogModel) -> str | None:
    detail = log.detail or {}
    event = detail.get("event")
    return event if isinstance(event, str) else None


def _get_detail_int(log: AuditLogModel, key: str) -> int | None:
    detail = log.detail or {}
    value = detail.get(key)
    return value if isinstance(value, int) else None


def _get_detail_str(log: AuditLogModel, key: str) -> str | None:
    detail = log.detail or {}
    value = detail.get(key)
    return value if isinstance(value, str) else None


def _filter_logs(
    logs: list[AuditLogModel],
    *,
    resource_type: str | None,
    action: str | None,
    event: str | None,
    security_only: bool,
) -> list[AuditLogModel]:
    filtered = logs
    if resource_type:
        filtered = [log for log in filtered if log.resource_type == resource_type]
    if security_only:
        filtered = [log for log in filtered if _get_event(log) in SECURITY_EVENTS]
    if action:
        filtered = [log for log in filtered if log.action == action]
    if event:
        filtered = [log for log in filtered if _get_event(log) == event]
    return filtered


def _to_audit_log_response(log: AuditLogModel) -> AuditLogResponse:
    return AuditLogResponse(
        id=log.id,
        actor=log.actor,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        resource_name=log.resource_name,
        detail=log.detail,
        event=_get_event(log),
        created_at=log.created_at,
    )

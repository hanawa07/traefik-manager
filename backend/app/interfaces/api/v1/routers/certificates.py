from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.certificates.certificate_alert_monitor import (
    check_certificate_alerts_once,
    get_certificate_alert_state,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError
from app.interfaces.api.v1.schemas.certificate_schemas import (
    CertificateCheckResponse,
    CertificatePreflightSnapshotResponse,
    CertificatePreflightResponse,
    CertificateResponse,
)

router = APIRouter()
CERTIFICATE_PREFLIGHT_EVENT = "certificate_preflight"


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


@router.get("", response_model=list[CertificateResponse], summary="인증서 목록")
async def list_certificates(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        certificates = await traefik_client.list_certificates()
        alert_state = await _get_certificate_alert_state(db)
        return [
            CertificateResponse.model_validate(
                _apply_alert_metadata(item, alert_state.get(item.get("domain", "")))
            )
            for item in certificates
        ]
    except TraefikApiClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Traefik API에서 인증서 정보를 가져오지 못했습니다",
        ) from exc


@router.post("/check", response_model=CertificateCheckResponse, summary="인증서 경고 수동 재검사")
async def check_certificates(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    try:
        return await check_certificate_alerts_once(
            client_factory=lambda: traefik_client,
            raise_on_error=True,
        )
    except TraefikApiClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Traefik API에서 인증서 정보를 가져오지 못했습니다",
        ) from exc


@router.post(
    "/preflight/{domain}",
    response_model=CertificatePreflightResponse,
    summary="인증서 발급 사전 진단",
)
async def preflight_certificate(
    domain: str,
    request: Request,
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        result = await traefik_client.get_certificate_preflight(domain)
        previous_result = await _get_previous_preflight_result(db, domain)
        await audit_service.record(
            db=db,
            actor=current_user.get("username", "unknown"),
            action="test",
            resource_type="certificate",
            resource_id=domain[:36],
            resource_name=domain,
            detail=_serialize_preflight_detail(result, get_client_ip(request)),
        )
        return {
            **result,
            "previous_result": previous_result,
        }
    except TraefikApiClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Traefik 인증서 발급 사전 진단을 실행하지 못했습니다",
        ) from exc


async def _get_certificate_alert_state(db: AsyncSession) -> dict[str, dict]:
    return await get_certificate_alert_state(db)


def _apply_alert_metadata(certificate: dict, state_entry: dict | None) -> dict:
    status = certificate.get("status")
    status_started_at_raw = state_entry.get("status_started_at") if isinstance(state_entry, dict) else None
    status_started_at = _parse_iso_datetime(status_started_at_raw)
    return {
        **certificate,
        "status_started_at": status_started_at,
        "alerts_suppressed": bool(status in {"warning", "error"} and status_started_at is not None),
    }


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


async def _get_previous_preflight_result(
    db: AsyncSession,
    domain: str,
) -> dict | None:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .where(AuditLogModel.resource_name == domain)
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    for log in logs:
        snapshot = _deserialize_preflight_snapshot(log.detail)
        if snapshot is not None:
            return snapshot
    return None


def _serialize_preflight_detail(result: dict, client_ip: str | None) -> dict:
    checked_at = result.get("checked_at")
    checked_at_iso = checked_at.astimezone(timezone.utc).isoformat() if isinstance(checked_at, datetime) else None
    return {
        "event": CERTIFICATE_PREFLIGHT_EVENT,
        "client_ip": client_ip,
        "checked_at": checked_at_iso,
        "overall_status": result.get("overall_status"),
        "recommendation": result.get("recommendation"),
        "items": [
            {
                "key": item.get("key"),
                "label": item.get("label"),
                "status": item.get("status"),
                "detail": item.get("detail"),
            }
            for item in result.get("items", [])
            if isinstance(item, dict)
        ],
    }


def _deserialize_preflight_snapshot(detail: dict | None) -> dict | None:
    if not isinstance(detail, dict):
        return None
    if detail.get("event") != CERTIFICATE_PREFLIGHT_EVENT:
        return None

    checked_at = detail.get("checked_at")
    overall_status = detail.get("overall_status")
    recommendation = detail.get("recommendation")
    raw_items = detail.get("items")

    if not isinstance(checked_at, str) or overall_status not in {"ok", "warning", "error"}:
        return None
    if not isinstance(recommendation, str) or not isinstance(raw_items, list):
        return None

    try:
        snapshot = CertificatePreflightSnapshotResponse.model_validate(
            {
                "checked_at": checked_at,
                "overall_status": overall_status,
                "recommendation": recommendation,
                "items": raw_items,
            }
        )
    except Exception:
        return None

    return snapshot.model_dump(mode="json")

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.audit import audit_service
from app.core.config import settings
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
CERTIFICATE_PREFLIGHT_REPEATED_FAILURE_EVENT = "certificate_preflight_repeated_failure"


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
        preflight_state = await _get_certificate_preflight_state(db)
        return [
            CertificateResponse.model_validate(
                _apply_preflight_metadata(
                    _apply_alert_metadata(item, alert_state.get(item.get("domain", ""))),
                    preflight_state.get(item.get("domain", "")),
                )
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
        previous_results = await _list_previous_preflight_results(db, domain)
        previous_result = previous_results[0] if previous_results else None
        repeated_failure_streak = _calculate_preflight_failure_streak(result, previous_results)
        repeated_failure_active = repeated_failure_streak >= settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD
        await audit_service.record(
            db=db,
            actor=current_user.get("username", "unknown"),
            action="test",
            resource_type="certificate",
            resource_id=domain[:36],
            resource_name=domain,
            detail=_serialize_preflight_detail(result, get_client_ip(request)),
        )
        if repeated_failure_streak == settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD:
            await audit_service.record(
                db=db,
                actor=current_user.get("username", "unknown"),
                action="alert",
                resource_type="certificate",
                resource_id=domain[:36],
                resource_name=domain,
                detail=_serialize_repeated_failure_detail(
                    result,
                    client_ip=get_client_ip(request),
                    consecutive_count=repeated_failure_streak,
                ),
            )
        return {
            **result,
            "previous_result": previous_result,
            "repeated_failure_streak": repeated_failure_streak,
            "repeated_failure_active": repeated_failure_active,
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


def _apply_preflight_metadata(certificate: dict, preflight_entry: dict | None) -> dict:
    if not isinstance(preflight_entry, dict):
        return {
            **certificate,
            "preflight_failure_streak": 0,
            "preflight_repeated_failure_active": False,
        }
    return {
        **certificate,
        "preflight_failure_streak": int(preflight_entry.get("failure_streak", 0)),
        "preflight_repeated_failure_active": bool(preflight_entry.get("repeated_failure_active", False)),
    }


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


async def _get_certificate_preflight_state(db: AsyncSession) -> dict[str, dict]:
    if not callable(getattr(db, "execute", None)):
        return {}
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    snapshots_by_domain: dict[str, list[dict]] = {}
    for log in logs:
        domain = getattr(log, "resource_name", None)
        if not isinstance(domain, str) or not domain:
            continue
        snapshot = _deserialize_preflight_snapshot(log.detail)
        if snapshot is None:
            continue
        snapshots_by_domain.setdefault(domain, []).append(snapshot)

    state: dict[str, dict] = {}
    for domain, snapshots in snapshots_by_domain.items():
        if not snapshots:
            continue
        failure_streak = _calculate_preflight_failure_streak(snapshots[0], snapshots[1:])
        state[domain] = {
            "failure_streak": failure_streak,
            "repeated_failure_active": failure_streak >= settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD,
        }
    return state


async def _list_previous_preflight_results(
    db: AsyncSession,
    domain: str,
) -> list[dict]:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "certificate")
        .where(AuditLogModel.resource_name == domain)
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()
    snapshots: list[dict] = []
    for log in logs:
        snapshot = _deserialize_preflight_snapshot(log.detail)
        if snapshot is not None:
            snapshots.append(snapshot)
    return snapshots


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


def _serialize_repeated_failure_detail(
    result: dict,
    *,
    client_ip: str | None,
    consecutive_count: int,
) -> dict:
    checked_at = result.get("checked_at")
    checked_at_iso = checked_at.astimezone(timezone.utc).isoformat() if isinstance(checked_at, datetime) else None
    failure_items = [
        item
        for item in result.get("items", [])
        if isinstance(item, dict) and item.get("status") in {"warning", "error"}
    ]
    return {
        "event": CERTIFICATE_PREFLIGHT_REPEATED_FAILURE_EVENT,
        "client_ip": client_ip,
        "checked_at": checked_at_iso,
        "overall_status": result.get("overall_status"),
        "recommendation": result.get("recommendation"),
        "consecutive_count": consecutive_count,
        "repeat_window_minutes": settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES,
        "failure_keys": [item.get("key") for item in failure_items if isinstance(item.get("key"), str)],
        "failure_details": [
            {
                "key": item.get("key"),
                "label": item.get("label"),
                "status": item.get("status"),
                "detail": item.get("detail"),
            }
            for item in failure_items
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


def _calculate_preflight_failure_streak(current_result: dict, previous_results: list[dict]) -> int:
    current_signature = _get_preflight_failure_signature(current_result)
    current_status = current_result.get("overall_status")
    current_checked_at = _extract_preflight_checked_at(current_result)
    if current_signature is None or current_status not in {"warning", "error"} or current_checked_at is None:
        return 0

    streak = 1
    window = timedelta(minutes=settings.CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES)
    for snapshot in previous_results:
        previous_signature = _get_preflight_failure_signature(snapshot)
        previous_status = snapshot.get("overall_status")
        previous_checked_at = _extract_preflight_checked_at(snapshot)
        if previous_signature is None or previous_status != current_status or previous_checked_at is None:
            break
        if current_checked_at - previous_checked_at > window:
            break
        if previous_signature != current_signature:
            break
        streak += 1
    return streak


def _get_preflight_failure_signature(result: dict) -> tuple[str, tuple[str, ...]] | None:
    overall_status = result.get("overall_status")
    if overall_status not in {"warning", "error"}:
        return None
    items = result.get("items")
    if not isinstance(items, list):
        return None
    failing_keys = sorted(
        item.get("key")
        for item in items
        if isinstance(item, dict)
        and item.get("status") in {"warning", "error"}
        and isinstance(item.get("key"), str)
    )
    if not failing_keys:
        return None
    return overall_status, tuple(failing_keys)


def _extract_preflight_checked_at(result: dict) -> datetime | None:
    checked_at = result.get("checked_at")
    if isinstance(checked_at, datetime):
        if checked_at.tzinfo is None:
            return checked_at.replace(tzinfo=timezone.utc)
        return checked_at.astimezone(timezone.utc)
    if isinstance(checked_at, str):
        try:
            parsed = datetime.fromisoformat(checked_at)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None

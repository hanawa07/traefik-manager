from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.certificate.preflight_service import (
    get_certificate_preflight_state as load_certificate_preflight_state,
    record_certificate_preflight_result,
)
from app.core.logging_config import get_client_ip
from app.infrastructure.certificates.certificate_alert_monitor import (
    check_certificate_alerts_once,
    get_certificate_alert_state,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError
from app.interfaces.api.v1.schemas.certificate_schemas import (
    CertificateCheckResponse,
    CertificatePreflightResponse,
    CertificateResponse,
)

router = APIRouter()


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
        tracking = await record_certificate_preflight_result(
            db=db,
            actor=current_user.get("username", "unknown"),
            domain=domain,
            result=result,
            client_ip=get_client_ip(request),
        )
        return {
            **result,
            "previous_result": tracking["previous_result"],
            "repeated_failure_streak": tracking["repeated_failure_streak"],
            "repeated_failure_active": tracking["repeated_failure_active"],
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
    return await load_certificate_preflight_state(db)

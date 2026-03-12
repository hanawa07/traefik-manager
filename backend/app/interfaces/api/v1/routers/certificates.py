from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.certificates.certificate_alert_monitor import (
    check_certificate_alerts_once,
    get_certificate_alert_state,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError
from app.interfaces.api.v1.schemas.certificate_schemas import CertificateCheckResponse, CertificateResponse

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

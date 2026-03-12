from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.certificates.certificate_alert_monitor import check_certificate_alerts_once
from app.interfaces.api.dependencies import get_current_user
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError
from app.interfaces.api.v1.schemas.certificate_schemas import CertificateCheckResponse, CertificateResponse

router = APIRouter()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


@router.get("", response_model=list[CertificateResponse], summary="인증서 목록")
async def list_certificates(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    try:
        return await traefik_client.list_certificates()
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

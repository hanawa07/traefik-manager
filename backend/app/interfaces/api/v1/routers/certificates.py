from fastapi import APIRouter, Depends, HTTPException, status

from app.interfaces.api.dependencies import get_current_user
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient, TraefikApiClientError
from app.interfaces.api.v1.schemas.certificate_schemas import CertificateResponse

router = APIRouter()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


@router.get("/", response_model=list[CertificateResponse], summary="인증서 목록")
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

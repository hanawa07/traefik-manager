from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.traefik.traefik_api_client import (
    TraefikApiClient,
    TraefikApiClientError,
)
from app.interfaces.api.v1.schemas.certificate_schemas import CertificateCheckResponse


@dataclass(frozen=True)
class CertificateCheckEndpoints:
    check_certificates: Callable[..., Any]


def register_certificate_check_routes(
    router: APIRouter,
    *,
    get_traefik_client: Callable[[], TraefikApiClient],
    current_user_dependency: Callable[..., Any],
    check_alerts_once_provider: Callable[[], Callable[..., Any]],
) -> CertificateCheckEndpoints:
    @router.post(
        "/check",
        response_model=CertificateCheckResponse,
        summary="인증서 경고 수동 재검사",
    )
    async def check_certificates(
        traefik_client: TraefikApiClient = Depends(get_traefik_client),
        _: dict = Depends(current_user_dependency),
    ):
        try:
            return await check_alerts_once_provider()(
                client_factory=lambda: traefik_client,
                raise_on_error=True,
            )
        except TraefikApiClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Traefik API에서 인증서 정보를 가져오지 못했습니다",
            ) from exc

    return CertificateCheckEndpoints(check_certificates=check_certificates)

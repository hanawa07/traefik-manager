from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.infrastructure.traefik.traefik_api_client import (
    TraefikApiClient,
    TraefikApiClientError,
)
from app.interfaces.api.v1.schemas.certificate_schemas import CertificateResponse


@dataclass(frozen=True)
class CertificateReadEndpoints:
    list_certificates: Callable[..., Any]


def register_certificate_read_routes(
    router: APIRouter,
    *,
    get_traefik_client: Callable[[], TraefikApiClient],
    current_user_dependency: Callable[..., Any],
    alert_state_provider: Callable[[], Callable[[AsyncSession], Any]],
    preflight_state_provider: Callable[[], Callable[[AsyncSession], Any]],
    apply_alert_metadata_func: Callable[[dict, dict | None], dict],
    apply_preflight_metadata_func: Callable[[dict, dict | None], dict],
) -> CertificateReadEndpoints:
    @router.get("", response_model=list[CertificateResponse], summary="인증서 목록")
    async def list_certificates(
        traefik_client: TraefikApiClient = Depends(get_traefik_client),
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(current_user_dependency),
    ):
        try:
            certificates = await traefik_client.list_certificates()
            alert_state = await alert_state_provider()(db)
            preflight_state = await preflight_state_provider()(db)
            return [
                CertificateResponse.model_validate(
                    apply_preflight_metadata_func(
                        apply_alert_metadata_func(
                            item,
                            alert_state.get(item.get("domain", "")),
                        ),
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

    return CertificateReadEndpoints(list_certificates=list_certificates)

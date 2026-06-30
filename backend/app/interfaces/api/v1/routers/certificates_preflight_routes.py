from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_client_ip
from app.infrastructure.persistence.database import get_db
from app.infrastructure.traefik.traefik_api_client import (
    TraefikApiClient,
    TraefikApiClientError,
)
from app.interfaces.api.v1.schemas.certificate_schemas import CertificatePreflightResponse


@dataclass(frozen=True)
class CertificatePreflightEndpoints:
    preflight_certificate: Callable[..., Any]


def register_certificate_preflight_routes(
    router: APIRouter,
    *,
    get_traefik_client: Callable[[], TraefikApiClient],
    current_user_dependency: Callable[..., Any],
    record_preflight_result_provider: Callable[[], Callable[..., Any]],
    diagnostics_settings_provider: Callable[[], Callable[[AsyncSession], Any]],
) -> CertificatePreflightEndpoints:
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
        current_user: dict = Depends(current_user_dependency),
    ):
        try:
            result = await traefik_client.get_certificate_preflight(domain)
            diagnostics_settings = await diagnostics_settings_provider()(db)
            tracking = await record_preflight_result_provider()(
                db=db,
                actor=current_user.get("username", "unknown"),
                domain=domain,
                result=result,
                client_ip=get_client_ip(request),
                config=diagnostics_settings,
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

    return CertificatePreflightEndpoints(preflight_certificate=preflight_certificate)

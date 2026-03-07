from fastapi import APIRouter, Depends

from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.traefik_schemas import (
    TraefikHealthResponse,
    TraefikRouterStatusResponse,
)

router = APIRouter()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


@router.get("/health", response_model=TraefikHealthResponse, summary="Traefik 연결 상태")
async def get_traefik_health(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.get_health()


@router.get("/routers", response_model=TraefikRouterStatusResponse, summary="Traefik 라우터 상태")
async def get_traefik_router_status(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.get_router_status()

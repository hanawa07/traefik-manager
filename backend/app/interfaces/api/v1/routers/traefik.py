from fastapi import APIRouter, Depends

from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.traefik_deployment import TraefikDeploymentInspector
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.traefik_schemas import (
    TraefikDeploymentStatusResponse,
    TraefikHealthResponse,
    TraefikMiddlewareListResponse,
    TraefikRouterStatusResponse,
)

router = APIRouter()


def get_traefik_client() -> TraefikApiClient:
    return TraefikApiClient()


def get_docker_client() -> DockerClient:
    return DockerClient()


@router.get("/health", response_model=TraefikHealthResponse, summary="Traefik 연결 상태")
async def get_traefik_health(
    refresh_latest: bool = False,
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.get_health(refresh_latest=refresh_latest)


@router.get("/deployment", response_model=TraefikDeploymentStatusResponse, summary="Traefik 배포 점검")
async def get_traefik_deployment_status(
    refresh_latest: bool = False,
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    health = await traefik_client.get_health(refresh_latest=refresh_latest)
    return await TraefikDeploymentInspector(docker_client).get_status(latest_version=health.get("latest_version"))


@router.get("/routers", response_model=TraefikRouterStatusResponse, summary="Traefik 라우터 상태")
async def get_traefik_router_status(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.get_router_status()


@router.get("/middlewares", response_model=TraefikMiddlewareListResponse, summary="Traefik 미들웨어 상태")
async def get_traefik_middlewares(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.list_middlewares()

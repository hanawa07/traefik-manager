from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.encoded_path_block_monitoring import (
    read_encoded_path_block_monitor_status,
)
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.traefik_deployment import TraefikDeploymentInspector
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.routers import traefik_updates
from app.interfaces.api.v1.schemas.traefik_schemas import (
    TraefikDeploymentStatusResponse,
    TraefikEncodedPathBlockSummaryResponse,
    TraefikHealthResponse,
    TraefikMiddlewareListResponse,
    TraefikRouterStatusResponse,
)

router = APIRouter()
router.include_router(traefik_updates.router)


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
    return await TraefikDeploymentInspector(docker_client).get_status(
        latest_version=health.get("latest_version")
    )


@router.get("/routers", response_model=TraefikRouterStatusResponse, summary="Traefik 라우터 상태")
async def get_traefik_router_status(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.get_router_status()


@router.get(
    "/encoded-path-blocks",
    response_model=TraefikEncodedPathBlockSummaryResponse,
    summary="Traefik 인코딩 예약 문자 경로 차단 요약",
)
async def get_traefik_encoded_path_blocks(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    summary = await traefik_client.get_encoded_path_blocks()
    monitor_status = await read_encoded_path_block_monitor_status(
        SQLiteSystemSettingsRepository(db)
    )
    return {**summary, **monitor_status}


@router.get("/middlewares", response_model=TraefikMiddlewareListResponse, summary="Traefik 미들웨어 상태")
async def get_traefik_middlewares(
    traefik_client: TraefikApiClient = Depends(get_traefik_client),
    _: dict = Depends(get_current_user),
):
    return await traefik_client.list_middlewares()

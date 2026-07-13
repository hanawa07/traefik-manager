from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.manager_health_monitoring import read_external_watchdog_stale_minutes
from app.core.manager_watchdog_state import read_manager_watchdog_state
from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.infrastructure.github_actions_run import GitHubActionsRunStatusReader
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.docker_schemas import (
    DockerContainerListResponse,
    DockerDeploymentInfoResponse,
)

router = APIRouter()


def get_docker_client() -> DockerClient:
    return DockerClient()


@router.get("/containers", response_model=DockerContainerListResponse, summary="Docker 컨테이너 목록")
async def list_containers(
    docker_client: DockerClient = Depends(get_docker_client),
    _: dict = Depends(get_current_user),
):
    try:
        return await docker_client.list_container_candidates()
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Docker 컨테이너 목록을 가져오지 못했습니다",
        ) from exc


@router.get("/deployment", response_model=DockerDeploymentInfoResponse, summary="Traefik Manager 배포 정보")
async def get_deployment_info(
    refresh_latest: bool = False,
    docker_client: DockerClient = Depends(get_docker_client),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        deployment = await docker_client.get_manager_deployment_info(refresh_latest=refresh_latest)
        stale_after_minutes = await read_external_watchdog_stale_minutes(
            SQLiteSystemSettingsRepository(db)
        )
        watchdog_state = read_manager_watchdog_state(stale_after_minutes=stale_after_minutes)
        run_status = await GitHubActionsRunStatusReader().get_status(
            watchdog_state["external_watchdog_last_alert_run_url"]
        )
        return {
            **deployment,
            **watchdog_state,
            **run_status,
        }
    except DockerClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="배포 정보를 가져오지 못했습니다",
        ) from exc

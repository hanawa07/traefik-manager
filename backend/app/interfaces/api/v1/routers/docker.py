from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.interfaces.api.dependencies import get_current_user
from app.interfaces.api.v1.schemas.docker_schemas import DockerContainerListResponse

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

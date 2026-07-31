from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status

from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.interfaces.api.v1.schemas.docker_container_schemas import (
    DockerContainerListResponse,
)


@dataclass(frozen=True)
class DockerContainerEndpoints:
    list_containers: Callable[..., Any]


def register_docker_container_routes(
    router: APIRouter,
    *,
    get_docker_client: Callable[[], DockerClient],
    current_user_dependency: Callable[..., Any],
) -> DockerContainerEndpoints:
    @router.get(
        "/containers",
        response_model=DockerContainerListResponse,
        summary="Docker 컨테이너 목록",
    )
    async def list_containers(
        docker_client: DockerClient = Depends(get_docker_client),
        _: dict = Depends(current_user_dependency),
    ):
        try:
            return await docker_client.list_container_candidates()
        except DockerClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Docker 컨테이너 목록을 가져오지 못했습니다",
            ) from exc

    return DockerContainerEndpoints(list_containers=list_containers)

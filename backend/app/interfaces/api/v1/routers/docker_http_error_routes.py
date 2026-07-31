from dataclasses import dataclass
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.infrastructure.docker.client import DockerClient, DockerClientError
from app.interfaces.api.v1.schemas.manager_http_error_schemas import (
    ManagerHttpErrorPreviewRequest,
    ManagerHttpErrorPreviewResponse,
    ManagerHttpErrorSummaryResponse,
)

MANAGER_HTTP_ERROR_WINDOW_OPTIONS = {6, 12, 24}


@dataclass(frozen=True)
class DockerHttpErrorEndpoints:
    get_manager_http_errors: Callable[..., Any]
    preview_manager_http_errors: Callable[..., Any]


def register_docker_http_error_routes(
    router: APIRouter,
    *,
    get_docker_client: Callable[[], DockerClient],
    current_user_dependency: Callable[..., Any],
    preview_reader_provider: Callable[[], Any],
) -> DockerHttpErrorEndpoints:
    @router.get(
        "/http-errors",
        response_model=ManagerHttpErrorSummaryResponse,
        summary="Traefik Manager API 오류 추이",
    )
    async def get_manager_http_errors(
        window_hours: int = Query(default=24, ge=6, le=24),
        path: str | None = Query(default=None, max_length=200),
        docker_client: DockerClient = Depends(get_docker_client),
        _: dict = Depends(current_user_dependency),
    ):
        if window_hours not in MANAGER_HTTP_ERROR_WINDOW_OPTIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="조회 기간은 6, 12, 24시간만 선택할 수 있습니다",
            )
        try:
            return await docker_client.get_manager_http_error_summary(
                window_hours=window_hours,
                path_filter=path,
            )
        except DockerClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Manager API 오류 추이를 가져오지 못했습니다",
            ) from exc

    @router.post(
        "/http-errors/preview",
        response_model=ManagerHttpErrorPreviewResponse,
        summary="Traefik Manager API 오류 임계치 미리보기",
    )
    async def preview_manager_http_errors(
        request: ManagerHttpErrorPreviewRequest,
        docker_client: DockerClient = Depends(get_docker_client),
        _: dict = Depends(current_user_dependency),
    ):
        return await preview_reader_provider()(
            docker_enabled=docker_client.enabled,
            window_minutes=request.window_minutes,
            excluded_paths=tuple(request.excluded_paths),
        )

    return DockerHttpErrorEndpoints(
        get_manager_http_errors=get_manager_http_errors,
        preview_manager_http_errors=preview_manager_http_errors,
    )

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.traefik_deployment import (
    TraefikDeploymentInspector,
    is_patch_update,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.infrastructure.traefik_update_operations import (
    TraefikUpdateAlreadyPendingError,
    TraefikUpdateQueueUnavailableError,
    queue_traefik_patch_update,
    read_traefik_update_operations,
)
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.traefik_schemas import (
    TraefikUpdateOperationsResponse,
    TraefikUpdateRequest,
    TraefikUpdateRequestResponse,
)

router = APIRouter()


def get_traefik_update_client() -> TraefikApiClient:
    return TraefikApiClient()


def get_traefik_update_docker_client() -> DockerClient:
    return DockerClient()


@router.get(
    "/update-operations",
    response_model=TraefikUpdateOperationsResponse,
    summary="Traefik 호스트 업데이트 실행기와 이력 조회",
)
async def get_traefik_update_operations(
    _: dict = Depends(get_current_user),
):
    return await asyncio.to_thread(read_traefik_update_operations)


@router.post(
    "/update-requests",
    response_model=TraefikUpdateRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Traefik 안전 패치 업데이트 요청",
)
async def request_traefik_patch_update(
    payload: TraefikUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
    traefik_client: TraefikApiClient = Depends(get_traefik_update_client),
    docker_client: DockerClient = Depends(get_traefik_update_docker_client),
):
    target_version = payload.target_version
    if not target_version.startswith("v"):
        target_version = f"v{target_version}"

    health = await traefik_client.get_health(refresh_latest=True)
    deployment = await TraefikDeploymentInspector(docker_client).get_status(
        latest_version=health.get("latest_version")
    )
    _validate_safe_patch_request(deployment, target_version)

    operations = await asyncio.to_thread(read_traefik_update_operations)
    runner = operations["runner"]
    if not isinstance(runner, dict) or not runner.get("available"):
        runner_message = runner.get("message") if isinstance(runner, dict) else None
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=runner_message or "Traefik 호스트 업데이트 실행기를 사용할 수 없습니다",
        )

    try:
        queued = await asyncio.to_thread(
            queue_traefik_patch_update,
            target_version=target_version,
            actor=actor["username"],
        )
    except TraefikUpdateAlreadyPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TraefikUpdateQueueUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await audit_service.record(
        db=db,
        actor=actor["username"],
        action="request",
        resource_type="traefik",
        resource_id=str(queued["request_id"]),
        resource_name=f"Traefik {target_version} 패치 업데이트",
        detail={
            "event": "traefik_patch_update_requested",
            "current_version": deployment.get("current_version"),
            "target_version": target_version,
            "client_ip": get_client_ip(request),
        },
    )
    return queued


def _validate_safe_patch_request(deployment: dict, target_version: str) -> None:
    if not deployment.get("enabled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Traefik 배포 정보를 확인할 수 없습니다",
        )
    if deployment.get("target_version") != target_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="최신 버전이 변경되었습니다. 대시보드를 새로 확인하세요",
        )
    current_version = deployment.get("current_version")
    if not deployment.get("update_available"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="현재 Traefik은 이미 최신 버전입니다",
        )
    if not is_patch_update(current_version, target_version):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="자동 요청은 동일 메이저·마이너의 패치 업데이트만 허용합니다",
        )
    failed_checks = [
        check.get("label", "사전 점검")
        for check in deployment.get("checks", [])
        if check.get("status") == "fail"
    ]
    if failed_checks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"업데이트 사전 점검 실패: {', '.join(failed_checks)}",
        )

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.docker.client import DockerClient
from app.infrastructure.github_actions_run import GitHubActionsRunStatusReader
from app.infrastructure.persistence.database import get_db
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.infrastructure.traefik_update_operations import read_traefik_update_operations
from app.infrastructure.traefik_update_requests import (
    queue_traefik_alert_retry,
    queue_traefik_patch_update,
)
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.traefik_update_actions import (
    get_traefik_update_operations_action,
    request_traefik_patch_update_action,
    require_runner_available,
    retry_traefik_rollback_alert_action,
    validate_safe_patch_request,
)
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
    return await get_traefik_update_operations_action(
        operations_reader=read_traefik_update_operations,
        run_status_reader=GitHubActionsRunStatusReader(),
    )


@router.post(
    "/update-operations/{request_id}/alert-retry",
    response_model=TraefikUpdateRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Traefik 자동 롤백 실패 알림 재시도",
)
async def retry_traefik_rollback_alert(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    return await retry_traefik_rollback_alert_action(
        request_id=request_id,
        db=db,
        actor=actor,
        client_ip_provider=lambda: get_client_ip(request),
        operations_reader=read_traefik_update_operations,
        queue_alert_retry=queue_traefik_alert_retry,
        audit_recorder=audit_service.record,
    )


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
    return await request_traefik_patch_update_action(
        payload=payload,
        db=db,
        actor=actor,
        client_ip_provider=lambda: get_client_ip(request),
        traefik_client=traefik_client,
        docker_client=docker_client,
        operations_reader=read_traefik_update_operations,
        queue_patch_update=queue_traefik_patch_update,
        audit_recorder=audit_service.record,
    )


_require_runner_available = require_runner_available
_validate_safe_patch_request = validate_safe_patch_request

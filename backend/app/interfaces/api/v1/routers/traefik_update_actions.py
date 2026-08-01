import asyncio
from typing import Any, Awaitable, Callable

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.traefik_deployment import TraefikDeploymentInspector
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.infrastructure.traefik_update_requests import (
    TraefikUpdateAlreadyPendingError,
    TraefikUpdateQueueUnavailableError,
)
from app.interfaces.api.v1.routers.traefik_update_audit import (
    record_patch_update_request_audit,
)
from app.interfaces.api.v1.routers.traefik_update_validation import (
    require_runner_available,
    validate_safe_patch_request,
)
from app.interfaces.api.v1.schemas.traefik_schemas import TraefikUpdateRequest


async def request_traefik_patch_update_action(
    *,
    payload: TraefikUpdateRequest,
    db: AsyncSession,
    actor: dict[str, Any],
    client_ip_provider: Callable[[], str],
    traefik_client: TraefikApiClient,
    docker_client: DockerClient,
    operations_reader: Callable[[], dict[str, object]],
    queue_patch_update: Callable[..., dict[str, object]],
    audit_recorder: Callable[..., Awaitable[None]],
) -> dict[str, object]:
    target_version = payload.target_version
    if not target_version.startswith("v"):
        target_version = f"v{target_version}"

    health = await traefik_client.get_health(refresh_latest=True)
    deployment = await TraefikDeploymentInspector(docker_client).get_status(
        latest_version=health.get("latest_version")
    )
    validate_safe_patch_request(deployment, target_version)

    operations = await asyncio.to_thread(operations_reader)
    require_runner_available(operations)
    try:
        queued = await asyncio.to_thread(
            queue_patch_update,
            target_version=target_version,
            actor=actor["username"],
        )
    except TraefikUpdateAlreadyPendingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except TraefikUpdateQueueUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await record_patch_update_request_audit(
        audit_recorder=audit_recorder,
        db=db,
        actor=actor["username"],
        queued=queued,
        current_version=deployment.get("current_version"),
        target_version=target_version,
        client_ip=client_ip_provider(),
    )
    return queued

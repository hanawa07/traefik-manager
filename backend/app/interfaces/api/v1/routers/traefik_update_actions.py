import asyncio
from typing import Any, Awaitable, Callable

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.docker.client import DockerClient
from app.infrastructure.docker.traefik_deployment import (
    TraefikDeploymentInspector,
    is_patch_update,
)
from app.infrastructure.traefik.traefik_api_client import TraefikApiClient
from app.infrastructure.traefik_update_requests import (
    TraefikUpdateAlreadyPendingError,
    TraefikUpdateQueueUnavailableError,
)
from app.interfaces.api.v1.schemas.traefik_schemas import TraefikUpdateRequest

MAX_ALERT_RUN_STATUS_LOOKUPS = 5
ALERT_RUN_STATUS_FIELDS = {
    "alert_run_status": "external_watchdog_last_alert_run_status",
    "alert_run_conclusion": "external_watchdog_last_alert_run_conclusion",
    "alert_run_checked_at": "external_watchdog_last_alert_run_checked_at",
    "alert_run_error": "external_watchdog_last_alert_run_error",
}


async def get_traefik_update_operations_action(
    *,
    operations_reader: Callable[[], dict[str, object]],
    run_status_reader: Any,
) -> dict[str, object]:
    operations = await asyncio.to_thread(operations_reader)
    history = operations.get("history")
    if not isinstance(history, list):
        return operations
    run_urls = list(
        dict.fromkeys(
            entry.get("alert_run_url")
            for entry in history
            if isinstance(entry, dict) and isinstance(entry.get("alert_run_url"), str)
        )
    )[:MAX_ALERT_RUN_STATUS_LOOKUPS]
    if not run_urls:
        return operations
    run_statuses = await run_status_reader.get_statuses(run_urls)
    operations["history"] = [
        _with_alert_run_status(entry, run_statuses) for entry in history
    ]
    return operations


async def retry_traefik_rollback_alert_action(
    *,
    request_id: str,
    db: AsyncSession,
    actor: dict[str, Any],
    client_ip_provider: Callable[[], str],
    operations_reader: Callable[[], dict[str, object]],
    queue_alert_retry: Callable[..., dict[str, object]],
    audit_recorder: Callable[..., Awaitable[None]],
) -> dict[str, object]:
    operations = await asyncio.to_thread(operations_reader)
    require_runner_available(operations)
    history = operations.get("history")
    entry = (
        next(
            (
                item
                for item in history
                if isinstance(item, dict) and item.get("request_id") == request_id
            ),
            None,
        )
        if isinstance(history, list)
        else None
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자동 롤백 실패 이력을 찾을 수 없습니다",
        )
    if (
        entry.get("status") != "rollback_failed"
        or entry.get("alert_request_status") != "request_failed"
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="알림 요청에 실패한 자동 롤백 이력만 재시도할 수 있습니다",
        )
    try:
        queued = await asyncio.to_thread(
            queue_alert_retry,
            source_request_id=request_id,
            target_version=str(entry["target_version"]),
            actor=actor["username"],
        )
    except TraefikUpdateAlreadyPendingError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TraefikUpdateQueueUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await audit_recorder(
        db=db,
        actor=actor["username"],
        action="request",
        resource_type="traefik",
        resource_id=str(queued["request_id"]),
        resource_name="Traefik 자동 롤백 실패 알림 재시도",
        detail={
            "event": "traefik_rollback_alert_retry_requested",
            "source_request_id": request_id,
            "target_version": entry["target_version"],
            "client_ip": client_ip_provider(),
        },
    )
    return queued


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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TraefikUpdateQueueUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await audit_recorder(
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
            "client_ip": client_ip_provider(),
        },
    )
    return queued


def require_runner_available(operations: dict[str, object]) -> None:
    runner = operations.get("runner")
    if isinstance(runner, dict) and runner.get("available"):
        return
    runner_message = runner.get("message") if isinstance(runner, dict) else None
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=runner_message or "Traefik 호스트 업데이트 실행기를 사용할 수 없습니다",
    )


def validate_safe_patch_request(deployment: dict[str, Any], target_version: str) -> None:
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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


def _with_alert_run_status(
    entry: object,
    run_statuses: dict[str, dict[str, object]],
) -> object:
    if not isinstance(entry, dict):
        return entry
    run_status = run_statuses.get(str(entry.get("alert_run_url")))
    if not run_status:
        return entry
    return {
        **entry,
        **{
            target: run_status.get(source)
            for target, source in ALERT_RUN_STATUS_FIELDS.items()
        },
    }

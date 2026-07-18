import asyncio

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.manager_deployment_bottleneck import (
    preview_manager_deployment_bottleneck_event_cleanup,
    prune_manager_deployment_bottleneck_events,
    read_manager_deployment_bottleneck_config,
    read_manager_deployment_bottleneck_state,
    write_manager_deployment_bottleneck_config,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.schemas.settings_deployment_schemas import (
    ManagerDeploymentBottleneckCleanupResponse,
    ManagerDeploymentBottleneckSettingsResponse,
    ManagerDeploymentBottleneckSettingsUpdateRequest,
)

router = APIRouter()


@router.get(
    "/deployment-bottleneck-alert",
    response_model=ManagerDeploymentBottleneckSettingsResponse,
    summary="Manager 배포 병목 운영 알림 설정 조회",
)
async def get_deployment_bottleneck_settings(
    _: dict = Depends(get_current_user),
):
    return read_manager_deployment_bottleneck_config()


@router.put(
    "/deployment-bottleneck-alert",
    response_model=ManagerDeploymentBottleneckSettingsResponse,
    summary="Manager 배포 병목 운영 알림 설정 저장",
)
async def update_deployment_bottleneck_settings(
    payload: ManagerDeploymentBottleneckSettingsUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    previous = read_manager_deployment_bottleneck_config()
    updated = write_manager_deployment_bottleneck_config(
        payload.threshold_ms,
        payload.consecutive_count,
        payload.event_retention_days
        if payload.event_retention_days is not None
        else previous["event_retention_days"],
    )
    await record_settings_update(
        audit_service=audit_service,
        db=db,
        actor=actor.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["deployment_bottleneck"],
        resource_name="Manager 배포 병목 운영 알림",
        before=previous,
        after=updated,
        client_ip=get_client_ip(request),
    )
    return updated


@router.get(
    "/deployment-bottleneck-alert/cleanup",
    response_model=ManagerDeploymentBottleneckCleanupResponse,
    summary="Manager 배포 병목 이벤트 정리 미리보기",
)
async def preview_deployment_bottleneck_event_cleanup(
    _: dict = Depends(get_current_user),
):
    state = read_manager_deployment_bottleneck_state()
    return await asyncio.to_thread(
        preview_manager_deployment_bottleneck_event_cleanup,
        int(state["effective_event_retention_days"]),
    )


@router.post(
    "/deployment-bottleneck-alert/cleanup",
    response_model=ManagerDeploymentBottleneckCleanupResponse,
    summary="Manager 배포 병목 이벤트 즉시 정리",
)
async def cleanup_deployment_bottleneck_events(
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    state = read_manager_deployment_bottleneck_state()
    retention_days = int(state["effective_event_retention_days"])
    result = await asyncio.to_thread(
        prune_manager_deployment_bottleneck_events,
        retention_days,
    )
    await audit_service.record(
        db=db,
        actor=actor["username"],
        action="cleanup",
        resource_type="settings",
        resource_id="deployment-bottleneck-alert",
        resource_name="Manager 배포 병목 이벤트",
        detail={
            "event": "deployment_bottleneck_events_cleanup",
            "retention_days": retention_days,
            "previous_event_count": result["deleted_count"] + result["retained_event_count"],
            "deleted_count": result["deleted_count"],
            "retained_event_count": result["retained_event_count"],
            "client_ip": get_client_ip(request),
        },
    )
    return result

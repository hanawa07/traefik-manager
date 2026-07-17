from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.logging_config import get_client_ip
from app.infrastructure.manager_deployment_bottleneck import (
    read_manager_deployment_bottleneck_config,
    write_manager_deployment_bottleneck_config,
)
from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_audit_helpers import record_settings_update
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.schemas.settings_deployment_schemas import (
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

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.core.time_display import get_server_time_context
from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import SQLiteRedirectHostRepository
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_cloudflare_router import router as cloudflare_router
from app.interfaces.api.v1.routers.settings_rollback_action import (
    rollback_settings_change_action as _rollback_settings_change_action,
)
from app.interfaces.api.v1.routers.settings_router_wiring import (
    build_default_settings_routes,
    read_settings_route,
    update_settings_route,
)
from app.interfaces.api.v1.routers.settings_security_alert_actions import (
    test_security_alert_settings_action as _test_security_alert_settings_action,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_action import (
    update_smoke_monitoring_settings_action as _update_smoke_monitoring_settings_action,
)
from app.interfaces.api.v1.routers.settings_smoke_monitoring_values import (
    read_smoke_monitoring_values,
    should_run_scheduled_smoke,
)
from app.interfaces.api.v1.routers.settings_smoke_rotation_response import (
    get_smoke_rotation_status_response as _get_smoke_rotation_status_response,
)
from app.interfaces.api.v1.routers.settings_smoke_run_action import (
    record_smoke_run_success_action as _record_smoke_run_success_action,
)
from app.interfaces.api.v1.routers.settings_standard_routes import register_settings_standard_routes
from app.interfaces.api.v1.routers.settings_test_history import (
    get_settings_test_history_response as _get_settings_test_history_response,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    SmokeMonitoringRunSuccessRequest,
    SmokeMonitoringRunSuccessResponse,
    SmokeMonitoringScheduleDecisionResponse,
    SmokeMonitoringSettingsUpdateRequest,
    SmokeRotationStatusResponse,
    SettingsRollbackActionResponse,
    SettingsTestHistoryResponse,
    SettingsTestActionResponse,
)

router = APIRouter()
router.include_router(cloudflare_router)

SETTINGS_ROUTES = build_default_settings_routes(
    server_time_context_getter_provider=lambda: get_server_time_context,
    service_repository_factory_provider=lambda: SQLiteServiceRepository,
    redirect_repository_factory_provider=lambda: SQLiteRedirectHostRepository,
    file_writer_factory_provider=lambda: FileProviderWriter,
)


async def _read_settings(route, db: AsyncSession):
    return await read_settings_route(
        route,
        db=db,
        settings_repository_factory=SQLiteSystemSettingsRepository,
    )


async def _update_settings(route, request, http_request, db: AsyncSession, actor: dict):
    return await update_settings_route(
        route,
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=SQLiteSystemSettingsRepository,
        audit_service=audit_service,
        client_ip_getter=_maybe_get_client_ip,
    )


STANDARD_ENDPOINTS = register_settings_standard_routes(
    router=router,
    settings_routes=SETTINGS_ROUTES,
    read_settings=_read_settings,
    update_settings=_update_settings,
)
get_traefik_dashboard_settings = STANDARD_ENDPOINTS.get_traefik_dashboard_settings
update_traefik_dashboard_settings = STANDARD_ENDPOINTS.update_traefik_dashboard_settings
get_time_display_settings = STANDARD_ENDPOINTS.get_time_display_settings
update_time_display_settings = STANDARD_ENDPOINTS.update_time_display_settings
get_certificate_diagnostics_settings = STANDARD_ENDPOINTS.get_certificate_diagnostics_settings
update_certificate_diagnostics_settings = STANDARD_ENDPOINTS.update_certificate_diagnostics_settings
get_upstream_security_settings = STANDARD_ENDPOINTS.get_upstream_security_settings
update_upstream_security_settings = STANDARD_ENDPOINTS.update_upstream_security_settings
get_login_defense_settings = STANDARD_ENDPOINTS.get_login_defense_settings
update_login_defense_settings = STANDARD_ENDPOINTS.update_login_defense_settings
get_security_alert_settings = STANDARD_ENDPOINTS.get_security_alert_settings
update_security_alert_settings = STANDARD_ENDPOINTS.update_security_alert_settings


# Scheduled Actions reads this non-sensitive boolean before creating a viewer session.
@router.get(
    "/smoke-schedule-decision",
    response_model=SmokeMonitoringScheduleDecisionResponse,
    summary="예약 운영 스모크 실행 여부 조회",
)
async def get_smoke_schedule_decision(
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteSystemSettingsRepository(db)
    monitoring = await read_smoke_monitoring_values(repo)
    return SmokeMonitoringScheduleDecisionResponse(
        should_run=should_run_scheduled_smoke(monitoring),
    )


@router.get(
    "/smoke-rotation",
    response_model=SmokeRotationStatusResponse,
    summary="운영 로그인·화면 점검과 viewer 계정 회전 상태 조회",
)
async def get_smoke_rotation_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await _get_smoke_rotation_status_response(
        db,
        include_recent_logs=current_user["role"] == "admin",
    )


@router.post(
    "/smoke-run-success",
    response_model=SmokeMonitoringRunSuccessResponse,
    summary="원격 운영 스모크 성공 결과 기록",
)
async def record_smoke_run_success(
    request: SmokeMonitoringRunSuccessRequest,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(get_current_user),
):
    return await _record_smoke_run_success_action(
        run_id=request.run_id,
        actor=actor,
        db=db,
        settings_repository_factory=SQLiteSystemSettingsRepository,
    )


@router.put(
    "/smoke-rotation",
    response_model=SmokeRotationStatusResponse,
    summary="운영 로그인·화면 점검 예약 설정 저장",
)
async def update_smoke_monitoring_settings(
    request: SmokeMonitoringSettingsUpdateRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    actor: dict = Depends(require_admin),
):
    return await _update_smoke_monitoring_settings_action(
        request=request,
        http_request=http_request,
        db=db,
        actor=actor,
        settings_repository_factory=SQLiteSystemSettingsRepository,
        audit_service=audit_service,
        client_ip_getter=_maybe_get_client_ip,
    )


@router.post(
    "/security-alerts/test",
    response_model=SettingsTestActionResponse,
    summary="보안 알림 테스트 전송",
)
async def test_security_alert_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _test_security_alert_settings_action(
        request=request,
        db=db,
        actor=_,
        notifier=security_alert_notifier,
        audit_service=audit_service,
        client_ip_getter=get_client_ip,
    )


@router.get("/test-history", response_model=SettingsTestHistoryResponse, summary="설정 테스트 이력 조회")
async def get_settings_test_history(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _get_settings_test_history_response(db)


@router.post(
    "/rollback/{audit_log_id}",
    response_model=SettingsRollbackActionResponse,
    summary="설정 변경 롤백",
)
async def rollback_settings_change(
    audit_log_id: str,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _rollback_settings_change_action(
        audit_log_id=audit_log_id,
        http_request=http_request,
        db=db,
        actor=_,
        settings_repository_factory=SQLiteSystemSettingsRepository,
        audit_service=audit_service,
        client_ip_getter=_maybe_get_client_ip,
    )


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)

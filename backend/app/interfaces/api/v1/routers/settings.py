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
from app.interfaces.api.v1.routers.settings_test_history import (
    get_settings_test_history_response as _get_settings_test_history_response,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
    SecurityAlertSettingsResponse,
    SettingsRollbackActionResponse,
    SettingsTestHistoryResponse,
    SettingsTestActionResponse,
    SecurityAlertSettingsUpdateRequest,
    TraefikDashboardSettingsResponse,
    TraefikDashboardSettingsUpdateRequest,
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
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


@router.get(
    "/traefik-dashboard",
    response_model=TraefikDashboardSettingsResponse,
    summary="Traefik 디버그 대시보드 공개 설정 조회",
)
async def get_traefik_dashboard_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.traefik_dashboard_read, db)


@router.put(
    "/traefik-dashboard",
    response_model=TraefikDashboardSettingsResponse,
    summary="Traefik 디버그 대시보드 공개 설정 저장",
)
async def update_traefik_dashboard_settings(
    request: TraefikDashboardSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(
        SETTINGS_ROUTES.traefik_dashboard_update,
        request,
        http_request,
        db,
        _,
    )


@router.get("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 조회")
async def get_time_display_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.time_display_read, db)


@router.put("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 저장")
async def update_time_display_settings(
    request: TimeDisplaySettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(
        SETTINGS_ROUTES.time_display_update,
        request,
        http_request,
        db,
        _,
    )


@router.get(
    "/certificate-diagnostics",
    response_model=CertificateDiagnosticsSettingsResponse,
    summary="인증서 진단 설정 조회",
)
async def get_certificate_diagnostics_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.certificate_diagnostics_read, db)


@router.put(
    "/certificate-diagnostics",
    response_model=CertificateDiagnosticsSettingsResponse,
    summary="인증서 진단 설정 저장",
)
async def update_certificate_diagnostics_settings(
    request: CertificateDiagnosticsSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(SETTINGS_ROUTES.certificate_diagnostics_update, request, http_request, db, _)


@router.get(
    "/upstream-security",
    response_model=UpstreamSecuritySettingsResponse,
    summary="업스트림 보안 설정 조회",
)
async def get_upstream_security_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.upstream_security_read, db)


@router.put(
    "/upstream-security",
    response_model=UpstreamSecuritySettingsResponse,
    summary="업스트림 보안 설정 저장",
)
async def update_upstream_security_settings(
    request: UpstreamSecuritySettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(SETTINGS_ROUTES.upstream_security_update, request, http_request, db, _)


@router.get("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 조회")
async def get_login_defense_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.login_defense_read, db)


@router.put("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 저장")
async def update_login_defense_settings(
    request: LoginDefenseSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(SETTINGS_ROUTES.login_defense_update, request, http_request, db, _)


@router.get("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 조회")
async def get_security_alert_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return await _read_settings(SETTINGS_ROUTES.security_alert_read, db)


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


@router.put("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 저장")
async def update_security_alert_settings(
    request: SecurityAlertSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return await _update_settings(SETTINGS_ROUTES.security_alert_update, request, http_request, db, _)


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

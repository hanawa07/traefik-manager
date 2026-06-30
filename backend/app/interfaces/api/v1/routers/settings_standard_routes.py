from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
    SecurityAlertSettingsResponse,
    SecurityAlertSettingsUpdateRequest,
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
    TraefikDashboardSettingsResponse,
    TraefikDashboardSettingsUpdateRequest,
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
)

ReadSettings = Callable[[Any, AsyncSession], Awaitable[Any]]
UpdateSettings = Callable[[Any, Any, Request | None, AsyncSession, dict], Awaitable[Any]]


@dataclass(frozen=True)
class SettingsStandardEndpoints:
    get_traefik_dashboard_settings: Callable[..., Awaitable[Any]]
    update_traefik_dashboard_settings: Callable[..., Awaitable[Any]]
    get_time_display_settings: Callable[..., Awaitable[Any]]
    update_time_display_settings: Callable[..., Awaitable[Any]]
    get_certificate_diagnostics_settings: Callable[..., Awaitable[Any]]
    update_certificate_diagnostics_settings: Callable[..., Awaitable[Any]]
    get_upstream_security_settings: Callable[..., Awaitable[Any]]
    update_upstream_security_settings: Callable[..., Awaitable[Any]]
    get_login_defense_settings: Callable[..., Awaitable[Any]]
    update_login_defense_settings: Callable[..., Awaitable[Any]]
    get_security_alert_settings: Callable[..., Awaitable[Any]]
    update_security_alert_settings: Callable[..., Awaitable[Any]]


def register_settings_standard_routes(
    *,
    router: APIRouter,
    settings_routes,
    read_settings: ReadSettings,
    update_settings: UpdateSettings,
) -> SettingsStandardEndpoints:
    @router.get(
        "/traefik-dashboard",
        response_model=TraefikDashboardSettingsResponse,
        summary="Traefik 디버그 대시보드 공개 설정 조회",
    )
    async def get_traefik_dashboard_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.traefik_dashboard_read, db)

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
        return await update_settings(settings_routes.traefik_dashboard_update, request, http_request, db, _)

    @router.get("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 조회")
    async def get_time_display_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.time_display_read, db)

    @router.put("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 저장")
    async def update_time_display_settings(
        request: TimeDisplaySettingsUpdateRequest,
        http_request: Request = None,
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(require_admin),
    ):
        return await update_settings(settings_routes.time_display_update, request, http_request, db, _)

    @router.get(
        "/certificate-diagnostics",
        response_model=CertificateDiagnosticsSettingsResponse,
        summary="인증서 진단 설정 조회",
    )
    async def get_certificate_diagnostics_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.certificate_diagnostics_read, db)

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
        return await update_settings(settings_routes.certificate_diagnostics_update, request, http_request, db, _)

    @router.get(
        "/upstream-security",
        response_model=UpstreamSecuritySettingsResponse,
        summary="업스트림 보안 설정 조회",
    )
    async def get_upstream_security_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.upstream_security_read, db)

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
        return await update_settings(settings_routes.upstream_security_update, request, http_request, db, _)

    @router.get("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 조회")
    async def get_login_defense_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.login_defense_read, db)

    @router.put("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 저장")
    async def update_login_defense_settings(
        request: LoginDefenseSettingsUpdateRequest,
        http_request: Request = None,
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(require_admin),
    ):
        return await update_settings(settings_routes.login_defense_update, request, http_request, db, _)

    @router.get("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 조회")
    async def get_security_alert_settings(
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(get_current_user),
    ):
        return await read_settings(settings_routes.security_alert_read, db)

    @router.put("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 저장")
    async def update_security_alert_settings(
        request: SecurityAlertSettingsUpdateRequest,
        http_request: Request = None,
        db: AsyncSession = Depends(get_db),
        _: dict = Depends(require_admin),
    ):
        return await update_settings(settings_routes.security_alert_update, request, http_request, db, _)

    return SettingsStandardEndpoints(
        get_traefik_dashboard_settings=get_traefik_dashboard_settings,
        update_traefik_dashboard_settings=update_traefik_dashboard_settings,
        get_time_display_settings=get_time_display_settings,
        update_time_display_settings=update_time_display_settings,
        get_certificate_diagnostics_settings=get_certificate_diagnostics_settings,
        update_certificate_diagnostics_settings=update_certificate_diagnostics_settings,
        get_upstream_security_settings=get_upstream_security_settings,
        update_upstream_security_settings=update_upstream_security_settings,
        get_login_defense_settings=get_login_defense_settings,
        update_login_defense_settings=update_login_defense_settings,
        get_security_alert_settings=get_security_alert_settings,
        update_security_alert_settings=update_security_alert_settings,
    )

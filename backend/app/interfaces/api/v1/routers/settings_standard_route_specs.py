from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

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


@dataclass(frozen=True)
class SettingsStandardRouteSpec:
    path: str
    read_route_name: str
    update_route_name: str
    read_function_name: str
    update_function_name: str
    response_model: type
    update_request_model: type
    read_summary: str
    update_summary: str


STANDARD_ROUTE_SPECS = (
    SettingsStandardRouteSpec(
        path="/traefik-dashboard",
        read_route_name="traefik_dashboard_read",
        update_route_name="traefik_dashboard_update",
        read_function_name="get_traefik_dashboard_settings",
        update_function_name="update_traefik_dashboard_settings",
        response_model=TraefikDashboardSettingsResponse,
        update_request_model=TraefikDashboardSettingsUpdateRequest,
        read_summary="Traefik 디버그 대시보드 공개 설정 조회",
        update_summary="Traefik 디버그 대시보드 공개 설정 저장",
    ),
    SettingsStandardRouteSpec(
        path="/time-display",
        read_route_name="time_display_read",
        update_route_name="time_display_update",
        read_function_name="get_time_display_settings",
        update_function_name="update_time_display_settings",
        response_model=TimeDisplaySettingsResponse,
        update_request_model=TimeDisplaySettingsUpdateRequest,
        read_summary="표시 시간대 설정 조회",
        update_summary="표시 시간대 설정 저장",
    ),
    SettingsStandardRouteSpec(
        path="/certificate-diagnostics",
        read_route_name="certificate_diagnostics_read",
        update_route_name="certificate_diagnostics_update",
        read_function_name="get_certificate_diagnostics_settings",
        update_function_name="update_certificate_diagnostics_settings",
        response_model=CertificateDiagnosticsSettingsResponse,
        update_request_model=CertificateDiagnosticsSettingsUpdateRequest,
        read_summary="인증서 진단 설정 조회",
        update_summary="인증서 진단 설정 저장",
    ),
    SettingsStandardRouteSpec(
        path="/upstream-security",
        read_route_name="upstream_security_read",
        update_route_name="upstream_security_update",
        read_function_name="get_upstream_security_settings",
        update_function_name="update_upstream_security_settings",
        response_model=UpstreamSecuritySettingsResponse,
        update_request_model=UpstreamSecuritySettingsUpdateRequest,
        read_summary="업스트림 보안 설정 조회",
        update_summary="업스트림 보안 설정 저장",
    ),
    SettingsStandardRouteSpec(
        path="/login-defense",
        read_route_name="login_defense_read",
        update_route_name="login_defense_update",
        read_function_name="get_login_defense_settings",
        update_function_name="update_login_defense_settings",
        response_model=LoginDefenseSettingsResponse,
        update_request_model=LoginDefenseSettingsUpdateRequest,
        read_summary="로그인 방어 설정 조회",
        update_summary="로그인 방어 설정 저장",
    ),
    SettingsStandardRouteSpec(
        path="/security-alerts",
        read_route_name="security_alert_read",
        update_route_name="security_alert_update",
        read_function_name="get_security_alert_settings",
        update_function_name="update_security_alert_settings",
        response_model=SecurityAlertSettingsResponse,
        update_request_model=SecurityAlertSettingsUpdateRequest,
        read_summary="보안 알림 설정 조회",
        update_summary="보안 알림 설정 저장",
    ),
)

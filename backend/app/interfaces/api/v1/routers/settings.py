from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.certificate_diagnostics import (
    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY,
    build_certificate_diagnostics_settings,
)
from app.core.logging_config import get_client_ip
from app.core.security import hash_basic_auth_password
from app.core.time_display import (
    get_display_timezone_label,
    get_display_timezone_name,
    get_server_time_context,
    normalize_display_timezone,
)
from app.domain.proxy.value_objects.upstream import normalize_domain_suffixes
from app.domain.proxy.value_objects.upstream_security_presets import (
    get_upstream_security_preset,
    infer_upstream_security_preset_key,
    list_upstream_security_presets,
)
from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError
from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import SQLiteRedirectHostRepository
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
    SecurityAlertSettingsResponse,
    SettingsRollbackActionResponse,
    SettingsTestHistoryItemResponse,
    SettingsTestHistoryResponse,
    SettingsTestActionResponse,
    SecurityAlertSettingsUpdateRequest,
    TraefikDashboardSettingsResponse,
    TraefikDashboardSettingsUpdateRequest,
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
    UpstreamSecurityPresetResponse,
    normalize_trusted_networks,
)

router = APIRouter()
SECURITY_ALERT_EVENTS = ["login_locked", "login_suspicious", "login_blocked_ip"]
CHANGE_ALERT_EVENTS = [
    "settings_change",
    "service_change",
    "redirect_change",
    "middleware_change",
    "user_change",
    "certificate_status_change",
    "certificate_preflight_failure",
    "rollback",
]
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"}
SECURITY_ALERT_ROUTE_TARGETS = {"default", "disabled", "telegram", "pagerduty", "email"}
SETTINGS_TEST_EVENTS = {
    "cloudflare": "settings_test_cloudflare",
    "cloudflare_reconcile": "settings_test_cloudflare_reconcile",
    "security_alert": "settings_test_security_alert",
}
SETTINGS_DELIVERY_EVENTS = {
    "security_alert_delivery": {
        "security_alert_delivery_success",
        "security_alert_delivery_failure",
    },
    "change_alert_delivery": {
        "change_alert_delivery_success",
        "change_alert_delivery_failure",
    },
}
SETTINGS_UPDATE_EVENTS = {
    "cloudflare": "settings_update_cloudflare",
    "traefik_dashboard": "settings_update_traefik_dashboard",
    "time_display": "settings_update_time_display",
    "certificate_diagnostics": "settings_update_certificate_diagnostics",
    "upstream_security": "settings_update_upstream_security",
    "login_defense": "settings_update_login_defense",
    "security_alert": "settings_update_security_alert",
}
SETTINGS_ROLLBACK_EVENTS = {
    SETTINGS_UPDATE_EVENTS["time_display"]: "settings_rollback_time_display",
    SETTINGS_UPDATE_EVENTS["upstream_security"]: "settings_rollback_upstream_security",
}


async def get_cloudflare_client(db: AsyncSession = Depends(get_db)) -> CloudflareClient:
    repo = SQLiteSystemSettingsRepository(db)
    db_settings = await repo.get_all_dict()
    return CloudflareClient.from_db_settings(db_settings)


@router.get("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 상태")
async def get_cloudflare_status(
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(get_current_user),
):
    return cloudflare_client.get_status()


@router.post("/cloudflare/test", response_model=SettingsTestActionResponse, summary="Cloudflare 연결 테스트")
async def test_cloudflare_connection(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    result = SettingsTestActionResponse(**(await cloudflare_client.test_connection()))
    await audit_service.record(
        db=db,
        actor=_.get("username", "unknown"),
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare"],
        resource_name="Cloudflare 연결 테스트",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "client_ip": get_client_ip(request),
        },
    )
    return result


@router.post("/cloudflare/reconcile", response_model=SettingsTestActionResponse, summary="Cloudflare DNS 재동기화")
async def reconcile_cloudflare_dns(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    total_service_count = 0
    eligible_service_count = 0
    skipped_count = 0
    synced_count = 0
    failed_count = 0
    cleaned_count = 0
    cleanup_failed_count = 0

    if not cloudflare_client.enabled:
        result = SettingsTestActionResponse(
            success=False,
            message="Cloudflare DNS 재동기화에 실패했습니다",
            detail="API token과 zone id를 먼저 저장해야 합니다",
            provider=None,
        )
    else:
        try:
            zone_name = await cloudflare_client.get_zone_name()
            if not zone_name:
                raise CloudflareClientError("Zone 이름을 확인할 수 없습니다")
        except CloudflareClientError as exc:
            result = SettingsTestActionResponse(
                success=False,
                message="Cloudflare DNS 재동기화에 실패했습니다",
                detail=str(exc),
                provider=None,
            )
        else:
            service_repository = SQLiteServiceRepository(db)
            services = await service_repository.find_all()
            total_service_count = len(services)
            eligible_services = [
                service
                for service in services
                if str(service.domain) == zone_name or str(service.domain).endswith(f".{zone_name}")
            ]
            eligible_service_count = len(eligible_services)

            synced_count = 0
            failed_count = 0
            skipped_count = len(services) - len(eligible_services)
            cleaned_count = 0
            cleanup_failed_count = 0
            failure_messages: list[str] = []

            for service in eligible_services:
                try:
                    record_id = await cloudflare_client.upsert_service_record(
                        domain=str(service.domain),
                        fallback_target=service.upstream.host,
                    )
                    if record_id != service.cloudflare_record_id:
                        service.cloudflare_record_id = record_id
                        await service_repository.save(service)
                    synced_count += 1
                except Exception as exc:
                    failed_count += 1
                    failure_messages.append(f"{service.domain}: {exc}")

            if eligible_services:
                current_domains = {str(service.domain) for service in eligible_services}
                try:
                    managed_records = await cloudflare_client.list_managed_records()
                except Exception as exc:
                    cleanup_failed_count += 1
                    failure_messages.append(f"관리 레코드 조회 실패: {exc}")
                else:
                    orphan_records = [
                        record
                        for record in managed_records
                        if isinstance(record.get("name"), str) and record["name"] not in current_domains
                    ]
                    for record in orphan_records:
                        domain = record.get("name")
                        record_id = record.get("id")
                        if not isinstance(domain, str):
                            continue
                        try:
                            await cloudflare_client.delete_service_record(domain=domain, record_id=record_id)
                            cleaned_count += 1
                        except Exception as exc:
                            cleanup_failed_count += 1
                            failure_messages.append(f"{domain} 정리 실패: {exc}")

            if not services:
                result = SettingsTestActionResponse(
                    success=True,
                    message="재동기화할 서비스가 없습니다",
                    detail=f"{zone_name} 영역에 일치하는 서비스가 없습니다",
                    provider=None,
                )
            elif not eligible_services:
                result = SettingsTestActionResponse(
                    success=True,
                    message="Cloudflare DNS 재동기화 대상이 없습니다",
                    detail=f"{zone_name} 영역에 속한 서비스가 없어 {len(services)}개 서비스를 건너뛰었습니다",
                    provider=None,
                )
            elif failed_count == 0 and cleanup_failed_count == 0:
                detail_parts = [f"{zone_name} 영역 서비스 {synced_count}개를 동기화했습니다"]
                if cleaned_count:
                    detail_parts.append(f"고아 레코드 {cleaned_count}개를 정리했습니다")
                if skipped_count:
                    detail_parts.append(f"다른 영역 서비스 {skipped_count}개는 건너뛰었습니다")
                result = SettingsTestActionResponse(
                    success=True,
                    message="Cloudflare DNS 재동기화가 완료되었습니다",
                    detail=", ".join(detail_parts),
                    provider=None,
                )
            else:
                failure_preview = " / ".join(failure_messages[:3])
                if len(failure_messages) > 3:
                    failure_preview += f" 외 {len(failure_messages) - 3}건"
                skipped_detail = (
                    f", 다른 영역 서비스 {skipped_count}개 건너뜀" if skipped_count else ""
                )
                cleanup_detail = (
                    f", 고아 레코드 정리 실패 {cleanup_failed_count}개" if cleanup_failed_count else ""
                )
                result = SettingsTestActionResponse(
                    success=False,
                    message=(
                        f"Cloudflare DNS 재동기화 중 일부 실패가 발생했습니다 "
                        f"(성공 {synced_count}개, 실패 {failed_count}개{cleanup_detail}{skipped_detail})"
                    ),
                    detail=failure_preview,
                    provider=None,
                )

    await audit_service.record(
        db=db,
        actor=_.get("username", "unknown"),
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare_reconcile"],
        resource_name="Cloudflare DNS 재동기화",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare_reconcile"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "total_services": total_service_count,
            "eligible_services": eligible_service_count,
            "skipped_services": skipped_count,
            "synced_services": synced_count,
            "failed_services": failed_count,
            "cleaned_records": cleaned_count,
            "cleanup_failed_records": cleanup_failed_count,
            "client_ip": get_client_ip(request),
        },
    )
    return result


@router.put("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 저장")
async def update_cloudflare_settings(
    request: CloudflareSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    previous_status = CloudflareClient.from_db_settings(await repo.get_all_dict()).get_status()

    if not request.api_token:
        # 빈 토큰 = 설정 전체 초기화
        for key in ("cf_api_token", "cf_zone_id", "cf_record_target", "cf_proxied"):
            await repo.delete(key)
    else:
        await repo.set("cf_api_token", request.api_token)
        await repo.set("cf_zone_id", request.zone_id)
        await repo.set("cf_record_target", request.record_target or None)
        await repo.set("cf_proxied", "true" if request.proxied else "false")

    db_settings = await repo.get_all_dict()
    current_status = CloudflareClient.from_db_settings(db_settings).get_status()
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["cloudflare"],
        resource_name="Cloudflare 설정",
        before=_cloudflare_summary(previous_status),
        after=_cloudflare_summary(current_status),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return current_status


@router.get(
    "/traefik-dashboard",
    response_model=TraefikDashboardSettingsResponse,
    summary="Traefik 디버그 대시보드 공개 설정 조회",
)
async def get_traefik_dashboard_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_traefik_dashboard_response(repo)


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
    repo = SQLiteSystemSettingsRepository(db)
    previous_response = await _build_traefik_dashboard_response(repo)

    existing_password_hash = await repo.get("traefik_dashboard_public_auth_password_hash")
    effective_password_hash = existing_password_hash or ""
    if request.auth_password:
        effective_password_hash = hash_basic_auth_password(request.auth_password)

    if request.enabled:
        if not request.domain or not request.auth_username:
            raise HTTPException(status_code=422, detail="공개 도메인과 기본 인증 사용자명이 필요합니다")
        if not effective_password_hash:
            raise HTTPException(status_code=422, detail="처음 활성화할 때는 기본 인증 비밀번호가 필요합니다")
        await _ensure_dashboard_domain_is_available(db, request.domain)

    await repo.set(
        "traefik_dashboard_public_enabled",
        "true" if request.enabled else "false",
    )
    await repo.set(
        "traefik_dashboard_public_domain",
        request.domain or None,
    )
    await repo.set(
        "traefik_dashboard_public_auth_username",
        request.auth_username or None,
    )
    if request.auth_password:
        await repo.set(
            "traefik_dashboard_public_auth_password_hash",
            effective_password_hash,
        )

    file_writer = FileProviderWriter()
    if request.enabled and request.domain and request.auth_username and effective_password_hash:
        file_writer.write_traefik_dashboard_public_route(
            domain=request.domain,
            basic_auth_username=request.auth_username,
            basic_auth_password_hash=effective_password_hash,
        )
    else:
        file_writer.delete_traefik_dashboard_public_route()

    response = await _build_traefik_dashboard_response(repo)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["traefik_dashboard"],
        resource_name="Traefik 디버그 대시보드 공개 설정",
        before=_traefik_dashboard_summary(previous_response),
        after=_traefik_dashboard_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return response


async def _ensure_dashboard_domain_is_available(db: AsyncSession, domain: str) -> None:
    service_repository = SQLiteServiceRepository(db)
    redirect_repository = SQLiteRedirectHostRepository(db)

    service = await service_repository.find_by_domain(domain)
    if service is not None:
        raise HTTPException(
            status_code=422,
            detail="이미 서비스에서 사용 중인 도메인입니다. 다른 공개 도메인을 사용해야 합니다.",
        )

    redirect_host = await redirect_repository.find_by_domain(domain)
    if redirect_host is not None:
        raise HTTPException(
            status_code=422,
            detail="이미 리다이렉트에서 사용 중인 도메인입니다. 다른 공개 도메인을 사용해야 합니다.",
        )


@router.get("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 조회")
async def get_time_display_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    stored_timezone = await repo.get("display_timezone")
    return _build_time_display_response(stored_timezone)


@router.put("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 저장")
async def update_time_display_settings(
    request: TimeDisplaySettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    previous_value = normalize_display_timezone(await repo.get("display_timezone"))
    await repo.set("display_timezone", request.display_timezone)
    response = _build_time_display_response(request.display_timezone)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["time_display"],
        resource_name="시간 표시 설정",
        before={"display_timezone": previous_value},
        after={"display_timezone": response.display_timezone},
        client_ip=_maybe_get_client_ip(http_request),
        rollback_payload={"display_timezone": previous_value},
    )
    return response


@router.get(
    "/certificate-diagnostics",
    response_model=CertificateDiagnosticsSettingsResponse,
    summary="인증서 진단 설정 조회",
)
async def get_certificate_diagnostics_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_certificate_diagnostics_response(repo)


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
    repo = SQLiteSystemSettingsRepository(db)
    previous_response = await _build_certificate_diagnostics_response(repo)
    await repo.set(CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY, str(request.auto_check_interval_minutes))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY, str(request.repeat_alert_threshold))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY, str(request.repeat_alert_window_minutes))
    await repo.set(CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY, str(request.repeat_alert_cooldown_minutes))
    response = await _build_certificate_diagnostics_response(repo)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["certificate_diagnostics"],
        resource_name="인증서 진단 설정",
        before=_certificate_diagnostics_summary(previous_response),
        after=_certificate_diagnostics_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return response


@router.get(
    "/upstream-security",
    response_model=UpstreamSecuritySettingsResponse,
    summary="업스트림 보안 설정 조회",
)
async def get_upstream_security_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_upstream_security_response(repo)


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
    repo = SQLiteSystemSettingsRepository(db)
    previous_response = await _build_upstream_security_response(repo)
    await repo.set("upstream_dns_strict_mode", "true" if request.dns_strict_mode else "false")
    await repo.set("upstream_allowlist_enabled", "true" if request.allowlist_enabled else "false")
    await repo.set(
        "upstream_allowed_domain_suffixes",
        "\n".join(request.allowed_domain_suffixes) or None,
    )
    await repo.set(
        "upstream_allow_docker_service_names",
        "true" if request.allow_docker_service_names else "false",
    )
    await repo.set(
        "upstream_allow_private_networks",
        "true" if request.allow_private_networks else "false",
    )
    response = await _build_upstream_security_response(repo)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["upstream_security"],
        resource_name="업스트림 보안 설정",
        before=_upstream_security_summary(previous_response),
        after=_upstream_security_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
        rollback_payload={
            "dns_strict_mode": previous_response.dns_strict_mode,
            "allowlist_enabled": previous_response.allowlist_enabled,
            "allowed_domain_suffixes": previous_response.allowed_domain_suffixes,
            "allow_docker_service_names": previous_response.allow_docker_service_names,
            "allow_private_networks": previous_response.allow_private_networks,
        },
    )
    return response


@router.get("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 조회")
async def get_login_defense_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_login_defense_response(repo)


@router.put("/login-defense", response_model=LoginDefenseSettingsResponse, summary="로그인 방어 설정 저장")
async def update_login_defense_settings(
    request: LoginDefenseSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    previous_response = await _build_login_defense_response(repo)
    existing_turnstile_secret = await repo.get("login_turnstile_secret_key")
    effective_turnstile_secret = request.turnstile_secret_key or existing_turnstile_secret or ""
    turnstile_enabled = request.turnstile_mode != "off"

    if turnstile_enabled and (not request.turnstile_site_key or not effective_turnstile_secret):
        raise HTTPException(status_code=422, detail="Turnstile site key와 secret key가 필요합니다")
    if (
        request.suspicious_block_escalation_enabled
        and request.suspicious_block_max_minutes < settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES
    ):
        raise HTTPException(status_code=422, detail="차단 최대 시간은 기본 차단 시간보다 작을 수 없습니다")

    await repo.set(
        "login_suspicious_block_enabled",
        "true" if request.suspicious_block_enabled else "false",
    )
    await repo.set(
        "login_suspicious_trusted_networks",
        "\n".join(request.suspicious_trusted_networks) or None,
    )
    await repo.set(
        "login_suspicious_block_escalation_enabled",
        "true" if request.suspicious_block_escalation_enabled else "false",
    )
    await repo.set(
        "login_suspicious_block_escalation_window_minutes",
        str(request.suspicious_block_escalation_window_minutes),
    )
    await repo.set(
        "login_suspicious_block_escalation_multiplier",
        str(request.suspicious_block_escalation_multiplier),
    )
    await repo.set(
        "login_suspicious_block_max_minutes",
        str(request.suspicious_block_max_minutes),
    )
    await repo.set(
        "login_turnstile_mode",
        request.turnstile_mode,
    )
    await repo.set(
        "login_turnstile_enabled",
        "true" if turnstile_enabled else "false",
    )
    await repo.set(
        "login_turnstile_site_key",
        request.turnstile_site_key or None,
    )
    if request.turnstile_secret_key:
        await repo.set(
            "login_turnstile_secret_key",
            request.turnstile_secret_key,
        )
    response = await _build_login_defense_response(repo)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["login_defense"],
        resource_name="로그인 방어 설정",
        before=_login_defense_summary(previous_response),
        after=_login_defense_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return response


@router.get("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 조회")
async def get_security_alert_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_security_alert_response(repo)


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
    result = SettingsTestActionResponse(**(await security_alert_notifier.send_test_alert(db)))
    await audit_service.record(
        db=db,
        actor=_.get("username", "unknown"),
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["security_alert"],
        resource_name="보안 알림 테스트",
        detail={
            "event": SETTINGS_TEST_EVENTS["security_alert"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "provider": result.provider,
            "client_ip": get_client_ip(request),
        },
    )
    return result


@router.get("/test-history", response_model=SettingsTestHistoryResponse, summary="설정 테스트 이력 조회")
async def get_settings_test_history(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.resource_type == "settings")
        .order_by(desc(AuditLogModel.created_at))
    )
    logs = result.scalars().all()

    cloudflare = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare"])
    cloudflare_reconcile = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare_reconcile"])
    security_alert = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["security_alert"])
    security_alert_delivery = _find_latest_settings_events(
        logs, SETTINGS_DELIVERY_EVENTS["security_alert_delivery"]
    )
    change_alert_delivery = _find_latest_settings_events(logs, SETTINGS_DELIVERY_EVENTS["change_alert_delivery"])
    return SettingsTestHistoryResponse(
        cloudflare=cloudflare,
        cloudflare_reconcile=cloudflare_reconcile,
        security_alert=security_alert,
        security_alert_delivery=security_alert_delivery,
        change_alert_delivery=change_alert_delivery,
    )


@router.put("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 저장")
async def update_security_alert_settings(
    request: SecurityAlertSettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    previous_response = await _build_security_alert_response(repo)
    if request.provider not in SECURITY_ALERT_PROVIDERS:
        raise HTTPException(status_code=422, detail="지원하지 않는 보안 알림 provider입니다")
    normalized_event_routes = _normalize_security_alert_event_routes(request.event_routes)
    normalized_change_event_routes = _normalize_change_alert_event_routes(request.change_event_routes)

    existing_telegram_bot_token = await repo.get("security_alert_telegram_bot_token")
    effective_telegram_bot_token = request.telegram_bot_token or existing_telegram_bot_token or ""
    existing_pagerduty_routing_key = await repo.get("security_alert_pagerduty_routing_key")
    effective_pagerduty_routing_key = request.pagerduty_routing_key or existing_pagerduty_routing_key or ""
    existing_email_password = await repo.get("security_alert_email_password")
    effective_email_password = request.email_password or existing_email_password or ""

    if request.enabled:
        for event_name in SECURITY_ALERT_EVENTS:
            effective_provider = _resolve_security_alert_provider(
                request.provider,
                normalized_event_routes[event_name],
            )
            if effective_provider is None:
                continue
            _validate_security_alert_provider_config(
                provider=effective_provider,
                request=request,
                effective_telegram_bot_token=effective_telegram_bot_token,
                effective_pagerduty_routing_key=effective_pagerduty_routing_key,
                effective_email_password=effective_email_password,
            )
    if request.change_alerts_enabled:
        for event_name in CHANGE_ALERT_EVENTS:
            effective_provider = _resolve_security_alert_provider(
                request.provider,
                normalized_change_event_routes[event_name],
            )
            if effective_provider is None:
                continue
            _validate_security_alert_provider_config(
                provider=effective_provider,
                request=request,
                effective_telegram_bot_token=effective_telegram_bot_token,
                effective_pagerduty_routing_key=effective_pagerduty_routing_key,
                effective_email_password=effective_email_password,
            )

    await repo.set(
        "security_alerts_enabled",
        "true" if request.enabled else "false",
    )
    await repo.set(
        "change_alerts_enabled",
        "true" if request.change_alerts_enabled else "false",
    )
    await repo.set(
        "security_alert_provider",
        request.provider,
    )
    await repo.set(
        "security_alert_webhook_url",
        request.webhook_url or None,
    )
    for event_name in SECURITY_ALERT_EVENTS:
        await repo.set(
            f"security_alert_route_{event_name}",
            normalized_event_routes[event_name],
        )
    for event_name in CHANGE_ALERT_EVENTS:
        await repo.set(
            f"security_alert_change_route_{event_name}",
            normalized_change_event_routes[event_name],
        )
    if request.telegram_bot_token:
        await repo.set("security_alert_telegram_bot_token", request.telegram_bot_token)
    await repo.set(
        "security_alert_telegram_chat_id",
        request.telegram_chat_id or None,
    )
    if request.pagerduty_routing_key:
        await repo.set("security_alert_pagerduty_routing_key", request.pagerduty_routing_key)
    await repo.set("security_alert_email_host", request.email_host or None)
    await repo.set("security_alert_email_port", str(request.email_port))
    await repo.set("security_alert_email_security", request.email_security)
    await repo.set("security_alert_email_username", request.email_username or None)
    if request.email_password:
        await repo.set("security_alert_email_password", request.email_password)
    await repo.set("security_alert_email_from", request.email_from or None)
    await repo.set(
        "security_alert_email_recipients",
        "\n".join(request.email_recipients) or None,
    )
    response = await _build_security_alert_response(repo)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["security_alert"],
        resource_name="보안 알림 설정",
        before=_security_alert_summary(previous_response),
        after=_security_alert_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return response


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
    result = await db.execute(select(AuditLogModel).where(AuditLogModel.id == audit_log_id))
    audit_log = result.scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(status_code=404, detail="대상 설정 변경 로그를 찾을 수 없습니다")
    if audit_log.resource_type != "settings" or audit_log.action != "update":
        raise HTTPException(status_code=422, detail="설정 변경 로그만 롤백할 수 있습니다")

    detail = audit_log.detail or {}
    event = detail.get("event")
    rollback_supported = detail.get("rollback_supported") is True
    rollback_payload = detail.get("rollback_payload")

    if not isinstance(event, str) or not rollback_supported or not isinstance(rollback_payload, dict):
        raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")

    repo = SQLiteSystemSettingsRepository(db)
    before_state = await _get_current_settings_summary_for_event(repo, event)
    after_state = await _apply_settings_rollback(repo, event, rollback_payload)
    rollback_event = SETTINGS_ROLLBACK_EVENTS[event]

    changed_keys = sorted([key for key in after_state.keys() if before_state.get(key) != after_state.get(key)])
    await audit_service.record(
        db=db,
        actor=_.get("username", "unknown"),
        action="rollback",
        resource_type="settings",
        resource_id=rollback_event,
        resource_name=audit_log.resource_name,
        detail={
            "event": rollback_event,
            "source_audit_id": audit_log_id,
            "changed_keys": changed_keys,
            "before": before_state,
            "after": after_state,
            "summary": after_state,
            "client_ip": _maybe_get_client_ip(http_request),
        },
    )
    return SettingsRollbackActionResponse(
        success=True,
        message=f"{audit_log.resource_name}을(를) 이전 상태로 되돌렸습니다",
        resource_name=audit_log.resource_name,
        event=rollback_event,
    )


def _build_time_display_response(display_timezone: str | None) -> TimeDisplaySettingsResponse:
    normalized_timezone = normalize_display_timezone(display_timezone)
    server_context = get_server_time_context()
    return TimeDisplaySettingsResponse(
        display_timezone=normalized_timezone,
        display_timezone_name=get_display_timezone_name(normalized_timezone),
        display_timezone_label=get_display_timezone_label(normalized_timezone),
        storage_timezone=server_context["storage_timezone"],
        server_timezone_name=server_context["server_timezone_name"],
        server_timezone_label=server_context["server_timezone_label"],
        server_timezone_offset=server_context["server_timezone_offset"],
        server_time_iso=server_context["server_time_iso"],
    )


async def _build_traefik_dashboard_response(
    repo: SQLiteSystemSettingsRepository,
) -> TraefikDashboardSettingsResponse:
    enabled = await _get_bool_setting(
        repo,
        "traefik_dashboard_public_enabled",
        default=False,
    )
    domain = ((await repo.get("traefik_dashboard_public_domain")) or "").strip().lower() or None
    auth_username = ((await repo.get("traefik_dashboard_public_auth_username")) or "").strip() or None
    auth_password_hash = ((await repo.get("traefik_dashboard_public_auth_password_hash")) or "").strip()
    configured = bool(domain and auth_username and auth_password_hash)

    if enabled and configured:
        message = "필요할 때만 잠깐 공개하는 디버그 라우트로 사용하세요."
    elif enabled:
        message = "활성화되어 있지만 공개 도메인 또는 기본 인증 설정이 불완전합니다."
    else:
        message = "기본적으로 비공개입니다. 필요할 때만 임시로 열어두는 것을 권장합니다."

    return TraefikDashboardSettingsResponse(
        enabled=enabled,
        configured=configured,
        domain=domain,
        public_url=f"https://{domain}" if domain else None,
        auth_username=auth_username,
        auth_password_configured=bool(auth_password_hash),
        message=message,
    )


async def _build_certificate_diagnostics_response(
    repo: SQLiteSystemSettingsRepository,
) -> CertificateDiagnosticsSettingsResponse:
    if callable(getattr(repo, "get_all_dict", None)):
        diagnostics_settings = build_certificate_diagnostics_settings(await repo.get_all_dict())
    else:
        diagnostics_settings = build_certificate_diagnostics_settings(
            {
                CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY
                ),
                CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY: await repo.get(
                    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY
                ),
            }
        )
    return CertificateDiagnosticsSettingsResponse(
        auto_check_interval_minutes=diagnostics_settings.auto_check_interval_minutes,
        repeat_alert_threshold=diagnostics_settings.repeat_alert_threshold,
        repeat_alert_window_minutes=diagnostics_settings.repeat_alert_window_minutes,
        repeat_alert_cooldown_minutes=diagnostics_settings.repeat_alert_cooldown_minutes,
    )


async def _build_upstream_security_response(
    repo: SQLiteSystemSettingsRepository,
) -> UpstreamSecuritySettingsResponse:
    dns_strict_mode = await _get_bool_setting(repo, "upstream_dns_strict_mode", default=False)
    allowlist_enabled = await _get_bool_setting(repo, "upstream_allowlist_enabled", default=False)
    allow_docker_service_names = await _get_bool_setting(
        repo,
        "upstream_allow_docker_service_names",
        default=True,
    )
    allow_private_networks = await _get_bool_setting(
        repo,
        "upstream_allow_private_networks",
        default=True,
    )
    preset_key = infer_upstream_security_preset_key(
        dns_strict_mode=dns_strict_mode,
        allowlist_enabled=allowlist_enabled,
        allow_docker_service_names=allow_docker_service_names,
        allow_private_networks=allow_private_networks,
    )
    preset = get_upstream_security_preset(preset_key)
    return UpstreamSecuritySettingsResponse(
        preset_key=preset.key,
        preset_name=preset.name,
        preset_description=preset.description,
        available_presets=[
            UpstreamSecurityPresetResponse(
                key=item.key,
                name=item.name,
                description=item.description,
                dns_strict_mode=item.dns_strict_mode,
                allowlist_enabled=item.allowlist_enabled,
                allow_docker_service_names=item.allow_docker_service_names,
                allow_private_networks=item.allow_private_networks,
            )
            for item in list_upstream_security_presets()
        ],
        dns_strict_mode=dns_strict_mode,
        allowlist_enabled=allowlist_enabled,
        allowed_domain_suffixes=normalize_domain_suffixes(
            _split_domain_suffixes(await repo.get("upstream_allowed_domain_suffixes"))
        ),
        allow_docker_service_names=allow_docker_service_names,
        allow_private_networks=allow_private_networks,
    )


async def _build_login_defense_response(
    repo: SQLiteSystemSettingsRepository,
) -> LoginDefenseSettingsResponse:
    turnstile_secret_key = await repo.get("login_turnstile_secret_key")
    turnstile_mode = await _get_turnstile_mode(repo)
    return LoginDefenseSettingsResponse(
        max_failed_attempts=settings.LOGIN_MAX_FAILED_ATTEMPTS,
        failure_window_minutes=settings.LOGIN_FAILURE_WINDOW_MINUTES,
        lockout_minutes=settings.LOGIN_LOCKOUT_MINUTES,
        suspicious_window_minutes=settings.LOGIN_SUSPICIOUS_WINDOW_MINUTES,
        suspicious_failure_count=settings.LOGIN_SUSPICIOUS_FAILURE_COUNT,
        suspicious_username_count=settings.LOGIN_SUSPICIOUS_USERNAME_COUNT,
        suspicious_block_minutes=settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES,
        suspicious_block_enabled=await _get_bool_setting(
            repo,
            "login_suspicious_block_enabled",
            default=True,
        ),
        suspicious_trusted_networks=normalize_trusted_networks(
            _split_networks(await repo.get("login_suspicious_trusted_networks"))
        ),
        suspicious_block_escalation_enabled=await _get_bool_setting(
            repo,
            "login_suspicious_block_escalation_enabled",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED,
        ),
        suspicious_block_escalation_window_minutes=await _get_int_setting(
            repo,
            "login_suspicious_block_escalation_window_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES,
        ),
        suspicious_block_escalation_multiplier=await _get_int_setting(
            repo,
            "login_suspicious_block_escalation_multiplier",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER,
        ),
        suspicious_block_max_minutes=await _get_int_setting(
            repo,
            "login_suspicious_block_max_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES,
        ),
        turnstile_mode=turnstile_mode,
        turnstile_enabled=turnstile_mode != "off",
        turnstile_site_key=await repo.get("login_turnstile_site_key"),
        turnstile_secret_key_configured=bool(turnstile_secret_key),
    )


async def _build_security_alert_response(
    repo: SQLiteSystemSettingsRepository,
) -> SecurityAlertSettingsResponse:
    provider = await repo.get("security_alert_provider") or "generic"
    telegram_bot_token = await repo.get("security_alert_telegram_bot_token")
    pagerduty_routing_key = await repo.get("security_alert_pagerduty_routing_key")
    email_password = await repo.get("security_alert_email_password")
    email_port_value = await repo.get("security_alert_email_port")
    try:
        email_port = int(email_port_value) if email_port_value else 587
    except ValueError:
        email_port = 587
    return SecurityAlertSettingsResponse(
        enabled=await _get_bool_setting(
            repo,
            "security_alerts_enabled",
            default=False,
        ),
        change_alerts_enabled=await _get_bool_setting(
            repo,
            "change_alerts_enabled",
            default=False,
        ),
        provider=provider if provider in SECURITY_ALERT_PROVIDERS else "generic",
        webhook_url=await repo.get("security_alert_webhook_url"),
        telegram_bot_token_configured=bool(telegram_bot_token),
        telegram_chat_id=await repo.get("security_alert_telegram_chat_id"),
        pagerduty_routing_key_configured=bool(pagerduty_routing_key),
        email_host=await repo.get("security_alert_email_host"),
        email_port=email_port,
        email_security=((await repo.get("security_alert_email_security")) or "starttls"),
        email_username=await repo.get("security_alert_email_username"),
        email_password_configured=bool(email_password),
        email_from=await repo.get("security_alert_email_from"),
        email_recipients=_split_networks(await repo.get("security_alert_email_recipients")),
        timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
        alert_events=SECURITY_ALERT_EVENTS,
        event_routes=await _build_security_alert_event_routes(repo),
        change_event_routes=await _build_change_alert_event_routes(repo),
    )


def _find_latest_settings_test_event(
    logs: list[AuditLogModel],
    event_name: str,
) -> SettingsTestHistoryItemResponse:
    return _find_latest_settings_events(logs, {event_name})


def _find_latest_settings_events(
    logs: list[AuditLogModel],
    event_names: set[str],
) -> SettingsTestHistoryItemResponse:
    latest: SettingsTestHistoryItemResponse | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_failure_audit_id: str | None = None
    last_failure_message: str | None = None
    last_failure_detail: str | None = None
    last_failure_provider: str | None = None
    recent_failure_count = 0
    failure_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    for log in logs:
        detail = log.detail or {}
        event_name = detail.get("event")
        if not isinstance(event_name, str) or event_name not in event_names:
            continue
        success = detail.get("success")
        created_at = _normalize_utc(log.created_at)
        if latest is None:
            latest = SettingsTestHistoryItemResponse(
                last_event=event_name,
                last_success=success if isinstance(success, bool) else None,
                last_message=detail.get("message") if isinstance(detail.get("message"), str) else None,
                last_detail=detail.get("detail") if isinstance(detail.get("detail"), str) else None,
                last_provider=detail.get("provider") if isinstance(detail.get("provider"), str) else None,
                last_created_at=created_at,
            )

        if isinstance(success, bool) and success and last_success_at is None:
            last_success_at = created_at

        if isinstance(success, bool) and not success:
            if last_failure_at is None:
                last_failure_at = created_at
                last_failure_audit_id = str(log.id)
                last_failure_message = detail.get("message") if isinstance(detail.get("message"), str) else None
                last_failure_detail = detail.get("detail") if isinstance(detail.get("detail"), str) else None
                last_failure_provider = detail.get("provider") if isinstance(detail.get("provider"), str) else None
            if created_at >= failure_cutoff:
                recent_failure_count += 1

    if latest is None:
        return SettingsTestHistoryItemResponse()

    latest.last_success_at = last_success_at
    latest.last_failure_at = last_failure_at
    latest.last_failure_audit_id = last_failure_audit_id
    latest.last_failure_message = last_failure_message
    latest.last_failure_detail = last_failure_detail
    latest.last_failure_provider = last_failure_provider
    latest.recent_failure_count = recent_failure_count
    return latest


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)


def _normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def _record_settings_update(
    *,
    db: AsyncSession,
    actor: str,
    event: str,
    resource_name: str,
    before: dict[str, object],
    after: dict[str, object],
    client_ip: str | None,
    rollback_payload: dict[str, object] | None = None,
) -> None:
    changed_keys = sorted([key for key in after.keys() if before.get(key) != after.get(key)])
    detail = {
        "event": event,
        "changed_keys": changed_keys,
        "before": before,
        "after": after,
        "summary": after,
        "rollback_supported": rollback_payload is not None,
        "client_ip": client_ip,
    }
    if rollback_payload is not None:
        detail["rollback_payload"] = rollback_payload
    await audit_service.record(
        db=db,
        actor=actor,
        action="update",
        resource_type="settings",
        resource_id=event,
        resource_name=resource_name,
        detail=detail,
    )


def _cloudflare_summary(status: CloudflareSettingsStatusResponse) -> dict[str, object]:
    return {
        "enabled": status.enabled,
        "configured": status.configured,
        "zone_id": status.zone_id,
        "record_target": status.record_target,
        "proxied": status.proxied,
    }


def _traefik_dashboard_summary(response: TraefikDashboardSettingsResponse) -> dict[str, object]:
    return {
        "enabled": response.enabled,
        "configured": response.configured,
        "domain": response.domain,
        "auth_username": response.auth_username,
        "auth_password_configured": response.auth_password_configured,
    }


def _certificate_diagnostics_summary(response: CertificateDiagnosticsSettingsResponse) -> dict[str, object]:
    return {
        "auto_check_interval_minutes": response.auto_check_interval_minutes,
        "repeat_alert_threshold": response.repeat_alert_threshold,
        "repeat_alert_window_minutes": response.repeat_alert_window_minutes,
        "repeat_alert_cooldown_minutes": response.repeat_alert_cooldown_minutes,
    }


def _upstream_security_summary(response: UpstreamSecuritySettingsResponse) -> dict[str, object]:
    return {
        "preset_key": response.preset_key,
        "dns_strict_mode": response.dns_strict_mode,
        "allowlist_enabled": response.allowlist_enabled,
        "allowed_domain_suffixes_count": len(response.allowed_domain_suffixes),
        "allow_docker_service_names": response.allow_docker_service_names,
        "allow_private_networks": response.allow_private_networks,
    }


def _login_defense_summary(response: LoginDefenseSettingsResponse) -> dict[str, object]:
    return {
        "suspicious_block_enabled": response.suspicious_block_enabled,
        "suspicious_trusted_networks_count": len(response.suspicious_trusted_networks),
        "suspicious_block_escalation_enabled": response.suspicious_block_escalation_enabled,
        "suspicious_block_escalation_window_minutes": response.suspicious_block_escalation_window_minutes,
        "suspicious_block_escalation_multiplier": response.suspicious_block_escalation_multiplier,
        "suspicious_block_max_minutes": response.suspicious_block_max_minutes,
        "turnstile_mode": response.turnstile_mode,
        "turnstile_enabled": response.turnstile_enabled,
        "turnstile_site_key_configured": bool(response.turnstile_site_key),
    }


def _security_alert_summary(response: SecurityAlertSettingsResponse) -> dict[str, object]:
    return {
        "enabled": response.enabled,
        "change_alerts_enabled": response.change_alerts_enabled,
        "provider": response.provider,
        "event_routes": response.event_routes,
        "change_event_routes": response.change_event_routes,
        "webhook_configured": bool(response.webhook_url),
        "telegram_chat_id_configured": bool(response.telegram_chat_id),
        "pagerduty_routing_key_configured": response.pagerduty_routing_key_configured,
        "email_host": response.email_host,
        "email_port": response.email_port,
        "email_security": response.email_security,
        "email_username": response.email_username,
        "email_from": response.email_from,
        "email_recipients_count": len(response.email_recipients),
    }


async def _build_security_alert_event_routes(
    repo: SQLiteSystemSettingsRepository,
) -> dict[str, str]:
    routes: dict[str, str] = {}
    for event_name in SECURITY_ALERT_EVENTS:
        stored_route = ((await repo.get(f"security_alert_route_{event_name}")) or "default").strip().lower()
        routes[event_name] = stored_route if stored_route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return routes


async def _build_change_alert_event_routes(
    repo: SQLiteSystemSettingsRepository,
) -> dict[str, str]:
    routes: dict[str, str] = {}
    for event_name in CHANGE_ALERT_EVENTS:
        stored_route = await _get_change_alert_route_value(repo, event_name)
        routes[event_name] = stored_route if stored_route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return routes


def _normalize_security_alert_event_routes(event_routes: dict[str, str]) -> dict[str, str]:
    normalized = {event_name: "default" for event_name in SECURITY_ALERT_EVENTS}
    for event_name, route in event_routes.items():
        normalized[event_name] = route if route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return normalized


def _normalize_change_alert_event_routes(event_routes: dict[str, str]) -> dict[str, str]:
    normalized = {event_name: "default" for event_name in CHANGE_ALERT_EVENTS}
    for event_name, route in event_routes.items():
        normalized[event_name] = route if route in SECURITY_ALERT_ROUTE_TARGETS else "default"
    return normalized


async def _get_change_alert_route_value(
    repo: SQLiteSystemSettingsRepository,
    event_name: str,
) -> str:
    stored_route = ((await repo.get(f"security_alert_change_route_{event_name}")) or "").strip().lower()
    if stored_route:
        return stored_route
    if event_name in {"certificate_status_change", "certificate_preflight_failure"}:
        legacy_route = ((await repo.get("security_alert_change_route_certificate_change")) or "").strip().lower()
        if legacy_route:
            return legacy_route
    return "default"


def _resolve_security_alert_provider(default_provider: str, route_target: str) -> str | None:
    if route_target == "disabled":
        return None
    if route_target == "default":
        return default_provider
    return route_target


def _validate_security_alert_provider_config(
    *,
    provider: str,
    request: SecurityAlertSettingsUpdateRequest,
    effective_telegram_bot_token: str,
    effective_pagerduty_routing_key: str,
    effective_email_password: str,
) -> None:
    if provider == "telegram":
        if not effective_telegram_bot_token or not request.telegram_chat_id:
            raise HTTPException(status_code=422, detail="Telegram bot token과 chat id가 필요합니다")
        return
    if provider == "pagerduty":
        if not effective_pagerduty_routing_key:
            raise HTTPException(status_code=422, detail="PagerDuty routing key가 필요합니다")
        return
    if provider == "email":
        if not request.email_host or not request.email_from or not request.email_recipients:
            raise HTTPException(status_code=422, detail="SMTP host, 발신자, 수신자 설정이 필요합니다")
        if request.email_username and not effective_email_password:
            raise HTTPException(status_code=422, detail="SMTP 비밀번호가 필요합니다")
        return
    if not request.webhook_url:
        raise HTTPException(status_code=422, detail="Webhook URL이 필요합니다")


async def _get_current_settings_summary_for_event(
    repo: SQLiteSystemSettingsRepository,
    event: str,
) -> dict[str, object]:
    if event == SETTINGS_UPDATE_EVENTS["time_display"]:
        return {"display_timezone": normalize_display_timezone(await repo.get("display_timezone"))}
    if event == SETTINGS_UPDATE_EVENTS["upstream_security"]:
        return _upstream_security_summary(await _build_upstream_security_response(repo))
    raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")


async def _apply_settings_rollback(
    repo: SQLiteSystemSettingsRepository,
    event: str,
    rollback_payload: dict[str, object],
) -> dict[str, object]:
    if event == SETTINGS_UPDATE_EVENTS["time_display"]:
        display_timezone = rollback_payload.get("display_timezone")
        if not isinstance(display_timezone, str):
            raise HTTPException(status_code=422, detail="유효한 표시 시간대 복원 정보가 없습니다")
        await repo.set("display_timezone", display_timezone)
        return {"display_timezone": normalize_display_timezone(await repo.get("display_timezone"))}

    if event == SETTINGS_UPDATE_EVENTS["upstream_security"]:
        allowed_domain_suffixes = rollback_payload.get("allowed_domain_suffixes")
        if not isinstance(allowed_domain_suffixes, list) or not all(
            isinstance(item, str) for item in allowed_domain_suffixes
        ):
            raise HTTPException(status_code=422, detail="유효한 업스트림 보안 복원 정보가 없습니다")

        await repo.set(
            "upstream_dns_strict_mode",
            "true" if rollback_payload.get("dns_strict_mode") else "false",
        )
        await repo.set(
            "upstream_allowlist_enabled",
            "true" if rollback_payload.get("allowlist_enabled") else "false",
        )
        await repo.set(
            "upstream_allowed_domain_suffixes",
            "\n".join(allowed_domain_suffixes),
        )
        await repo.set(
            "upstream_allow_docker_service_names",
            "true" if rollback_payload.get("allow_docker_service_names") else "false",
        )
        await repo.set(
            "upstream_allow_private_networks",
            "true" if rollback_payload.get("allow_private_networks") else "false",
        )
        return _upstream_security_summary(await _build_upstream_security_response(repo))

    raise HTTPException(status_code=422, detail="이 설정 변경은 안전 롤백을 지원하지 않습니다")


async def _get_bool_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: bool,
) -> bool:
    value = await repo.get(key)
    if value is None:
        return default
    return value.strip().lower() == "true"


async def _get_int_setting(
    repo: SQLiteSystemSettingsRepository,
    key: str,
    *,
    default: int,
) -> int:
    value = await repo.get(key)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


async def _get_turnstile_mode(repo: SQLiteSystemSettingsRepository) -> str:
    stored_mode = ((await repo.get("login_turnstile_mode")) or "").strip().lower()
    if stored_mode in {"off", "always", "risk_based"}:
        return stored_mode

    legacy_enabled = await _get_bool_setting(repo, "login_turnstile_enabled", default=False)
    return "always" if legacy_enabled else "off"


def _split_domain_suffixes(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def _split_networks(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]

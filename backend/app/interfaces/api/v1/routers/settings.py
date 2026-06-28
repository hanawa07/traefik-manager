# PONYTAIL-DEBT(settings-router): replace repeated settings get/update/audit flows with a registry/helper.
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.core.time_display import (
    get_display_timezone_label,
    get_display_timezone_name,
    get_server_time_context,
    normalize_display_timezone,
)
from app.infrastructure.cloudflare.client import (
    CF_ZONE_CONFIGS_KEY,
    CloudflareClient,
    CloudflareClientError,
    CloudflareZoneConfig,
)
from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.infrastructure.persistence.repositories.sqlite_redirect_host_repository import SQLiteRedirectHostRepository
from app.infrastructure.persistence.repositories.sqlite_service_repository import SQLiteServiceRepository
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.routers.settings_audit_helpers import (
    find_latest_settings_events as _find_latest_settings_events,
    find_latest_settings_test_event as _find_latest_settings_test_event,
)
from app.interfaces.api.v1.routers.settings_certificate_diagnostics_update import (
    update_certificate_diagnostics_settings_values,
)
from app.interfaces.api.v1.routers.settings_cloudflare_drift import diagnose_cloudflare_dns_drift_records
from app.interfaces.api.v1.routers.settings_cloudflare_reconcile import reconcile_cloudflare_dns_records
from app.interfaces.api.v1.routers.settings_cloudflare_update import update_cloudflare_settings_values
from app.interfaces.api.v1.routers.settings_response_builders import (
    build_certificate_diagnostics_response as _build_certificate_diagnostics_response,
    build_login_defense_response as _build_login_defense_response,
    build_security_alert_response as _build_security_alert_response,
    build_traefik_dashboard_response as _build_traefik_dashboard_response,
    build_upstream_security_response as _build_upstream_security_response,
)
from app.interfaces.api.v1.routers.settings_login_defense_update import update_login_defense_settings_values
from app.interfaces.api.v1.routers.settings_security_alert_update import update_security_alert_settings_values
from app.interfaces.api.v1.routers.settings_traefik_dashboard_update import (
    update_traefik_dashboard_settings_values,
)
from app.interfaces.api.v1.routers.settings_upstream_security_update import update_upstream_security_settings_values
from app.interfaces.api.v1.routers.settings_summary_helpers import (
    certificate_diagnostics_summary as _certificate_diagnostics_summary,
    cloudflare_summary as _cloudflare_summary,
    login_defense_summary as _login_defense_summary,
    security_alert_summary as _security_alert_summary,
    traefik_dashboard_summary as _traefik_dashboard_summary,
    upstream_security_summary as _upstream_security_summary,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CertificateDiagnosticsSettingsUpdateRequest,
    CloudflareDriftCheckResponse,
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
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
SETTINGS_TEST_EVENTS = {
    "cloudflare": "settings_test_cloudflare",
    "cloudflare_drift": "settings_test_cloudflare_drift",
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


@router.post("/cloudflare/drift", response_model=CloudflareDriftCheckResponse, summary="Cloudflare DNS 드리프트 진단")
async def diagnose_cloudflare_dns_drift(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cloudflare_client: CloudflareClient = Depends(get_cloudflare_client),
    _: dict = Depends(require_admin),
):
    summary = await diagnose_cloudflare_dns_drift_records(
        cloudflare_client=cloudflare_client,
        service_repository=SQLiteServiceRepository(db),
    )
    result = summary.result

    await audit_service.record(
        db=db,
        actor=_.get("username", "unknown"),
        action="test",
        resource_type="settings",
        resource_id=SETTINGS_TEST_EVENTS["cloudflare_drift"],
        resource_name="Cloudflare DNS 드리프트 진단",
        detail={
            "event": SETTINGS_TEST_EVENTS["cloudflare_drift"],
            "success": result.success,
            "message": result.message,
            "detail": result.detail,
            "zone_count": summary.zone_count,
            "total_services": summary.total_service_count,
            "eligible_services": summary.eligible_service_count,
            "skipped_services": summary.skipped_count,
            "healthy_services": summary.healthy_count,
            "missing_records": len(summary.missing_records),
            "mismatched_records": len(summary.mismatched_records),
            "orphan_records": len(summary.orphan_records),
            "excluded_services": len(summary.excluded_services),
            "sample_missing_domains": [item.domain for item in summary.missing_records[:5]],
            "sample_mismatched_domains": [item.domain for item in summary.mismatched_records[:5]],
            "sample_orphan_domains": [item.domain for item in summary.orphan_records[:5]],
            "sample_excluded_domains": [item.domain for item in summary.excluded_services[:5]],
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
    summary = await reconcile_cloudflare_dns_records(
        cloudflare_client=cloudflare_client,
        service_repository=SQLiteServiceRepository(db),
    )
    result = summary.result

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
            "total_services": summary.total_service_count,
            "eligible_services": summary.eligible_service_count,
            "skipped_services": summary.skipped_count,
            "synced_services": summary.synced_count,
            "failed_services": summary.failed_count,
            "cleaned_records": summary.cleaned_count,
            "cleanup_failed_records": summary.cleanup_failed_count,
            "zone_count": summary.zone_count,
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
    previous_status, current_status = await update_cloudflare_settings_values(repo, request)
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

    previous_response, response, effective_password_hash = await update_traefik_dashboard_settings_values(
        repo,
        request,
        lambda domain: _ensure_dashboard_domain_is_available(db, domain),
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
    previous_response, response = await update_certificate_diagnostics_settings_values(repo, request)
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
    previous_response, response, rollback_payload = await update_upstream_security_settings_values(repo, request)
    await _record_settings_update(
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["upstream_security"],
        resource_name="업스트림 보안 설정",
        before=_upstream_security_summary(previous_response),
        after=_upstream_security_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
        rollback_payload=rollback_payload,
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
    previous_response, response = await update_login_defense_settings_values(repo, request)
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
    cloudflare_drift = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare_drift"])
    cloudflare_reconcile = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["cloudflare_reconcile"])
    security_alert = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["security_alert"])
    security_alert_delivery = _find_latest_settings_events(
        logs, SETTINGS_DELIVERY_EVENTS["security_alert_delivery"]
    )
    change_alert_delivery = _find_latest_settings_events(logs, SETTINGS_DELIVERY_EVENTS["change_alert_delivery"])
    return SettingsTestHistoryResponse(
        cloudflare=cloudflare,
        cloudflare_drift=cloudflare_drift,
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
    previous_response, response = await update_security_alert_settings_values(repo, request)
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


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)


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

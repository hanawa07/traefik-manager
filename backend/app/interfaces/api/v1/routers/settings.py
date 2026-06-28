from fastapi import APIRouter, Depends, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit import audit_service
from app.core.config import settings
from app.core.logging_config import get_client_ip
from app.core.time_display import get_server_time_context
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
    build_settings_test_history_response as _build_settings_test_history_response,
    record_cloudflare_connection_test_audit as _record_cloudflare_connection_test_audit,
    record_cloudflare_drift_audit as _record_cloudflare_drift_audit,
    record_cloudflare_reconcile_audit as _record_cloudflare_reconcile_audit,
    record_security_alert_test_audit as _record_security_alert_test_audit,
    record_settings_rollback as _record_settings_rollback,
    record_settings_update as _record_settings_update,
)
from app.interfaces.api.v1.routers.settings_certificate_diagnostics_update import (
    update_certificate_diagnostics_settings_values,
)
from app.interfaces.api.v1.routers.settings_cloudflare_drift import diagnose_cloudflare_dns_drift_records
from app.interfaces.api.v1.routers.settings_cloudflare_reconcile import reconcile_cloudflare_dns_records
from app.interfaces.api.v1.routers.settings_cloudflare_update import update_cloudflare_settings_values
from app.interfaces.api.v1.routers.settings_events import SETTINGS_UPDATE_EVENTS
from app.interfaces.api.v1.routers.settings_response_builders import (
    build_certificate_diagnostics_response as _build_certificate_diagnostics_response,
    build_login_defense_response as _build_login_defense_response,
    build_security_alert_response as _build_security_alert_response,
    build_traefik_dashboard_response as _build_traefik_dashboard_response,
    build_upstream_security_response as _build_upstream_security_response,
)
from app.interfaces.api.v1.routers.settings_rollback_helpers import (
    apply_settings_rollback as _apply_settings_rollback,
    get_current_settings_summary_for_event as _get_current_settings_summary_for_event,
    load_supported_settings_rollback as _load_supported_settings_rollback,
)
from app.interfaces.api.v1.routers.settings_login_defense_update import update_login_defense_settings_values
from app.interfaces.api.v1.routers.settings_security_alert_update import update_security_alert_settings_values
from app.interfaces.api.v1.routers.settings_traefik_dashboard_update import (
    ensure_dashboard_domain_is_available,
    update_traefik_dashboard_settings_values,
)
from app.interfaces.api.v1.routers.settings_time_display_response import (
    build_time_display_response as _build_time_display_response,
)
from app.interfaces.api.v1.routers.settings_time_display_update import update_time_display_settings_value
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
    await _record_cloudflare_connection_test_audit(
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        result=result,
        client_ip=get_client_ip(request),
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

    await _record_cloudflare_drift_audit(
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        summary=summary,
        client_ip=get_client_ip(request),
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

    await _record_cloudflare_reconcile_audit(
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        summary=summary,
        client_ip=get_client_ip(request),
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
        audit_service=audit_service,
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
        lambda domain: ensure_dashboard_domain_is_available(
            SQLiteServiceRepository(db),
            SQLiteRedirectHostRepository(db),
            domain,
        ),
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
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        event=SETTINGS_UPDATE_EVENTS["traefik_dashboard"],
        resource_name="Traefik 디버그 대시보드 공개 설정",
        before=_traefik_dashboard_summary(previous_response),
        after=_traefik_dashboard_summary(response),
        client_ip=_maybe_get_client_ip(http_request),
    )
    return response


@router.get("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 조회")
async def get_time_display_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    stored_timezone = await repo.get("display_timezone")
    return _build_time_display_response(stored_timezone, get_server_time_context())


@router.put("/time-display", response_model=TimeDisplaySettingsResponse, summary="표시 시간대 설정 저장")
async def update_time_display_settings(
    request: TimeDisplaySettingsUpdateRequest,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    previous_value = await update_time_display_settings_value(repo, request.display_timezone)
    response = _build_time_display_response(request.display_timezone, get_server_time_context())
    await _record_settings_update(
        audit_service=audit_service,
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
        audit_service=audit_service,
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
        audit_service=audit_service,
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
        audit_service=audit_service,
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
    await _record_security_alert_test_audit(
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        result=result,
        client_ip=get_client_ip(request),
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
    return _build_settings_test_history_response(logs)


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
        audit_service=audit_service,
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
    audit_log, event, rollback_payload, rollback_event = await _load_supported_settings_rollback(db, audit_log_id)
    repo = SQLiteSystemSettingsRepository(db)
    before_state = await _get_current_settings_summary_for_event(repo, event)
    after_state = await _apply_settings_rollback(repo, event, rollback_payload)

    await _record_settings_rollback(
        audit_service=audit_service,
        db=db,
        actor=_.get("username", "unknown"),
        rollback_event=rollback_event,
        source_audit_id=audit_log_id,
        resource_name=audit_log.resource_name,
        before=before_state,
        after=after_state,
        client_ip=_maybe_get_client_ip(http_request),
    )
    return SettingsRollbackActionResponse(
        success=True,
        message=f"{audit_log.resource_name}을(를) 이전 상태로 되돌렸습니다",
        resource_name=audit_log.resource_name,
        event=rollback_event,
    )


def _maybe_get_client_ip(http_request: Request | None) -> str | None:
    if http_request is None:
        return None
    return get_client_ip(http_request)

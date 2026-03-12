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
from app.domain.proxy.value_objects.upstream import normalize_domain_suffixes
from app.domain.proxy.value_objects.upstream_security_presets import (
    get_upstream_security_preset,
    infer_upstream_security_preset_key,
    list_upstream_security_presets,
)
from app.infrastructure.cloudflare.client import CloudflareClient
from app.infrastructure.notifications import security_alert_notifier
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import AuditLogModel
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_schemas import (
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
    TimeDisplaySettingsResponse,
    TimeDisplaySettingsUpdateRequest,
    UpstreamSecuritySettingsResponse,
    UpstreamSecuritySettingsUpdateRequest,
    UpstreamSecurityPresetResponse,
    normalize_trusted_networks,
)

router = APIRouter()
SECURITY_ALERT_EVENTS = ["login_locked", "login_suspicious", "login_blocked_ip"]
SECURITY_ALERT_PROVIDERS = {"generic", "slack", "discord", "telegram", "teams", "pagerduty", "email"}
SETTINGS_TEST_EVENTS = {
    "cloudflare": "settings_test_cloudflare",
    "security_alert": "settings_test_security_alert",
}
SETTINGS_UPDATE_EVENTS = {
    "cloudflare": "settings_update_cloudflare",
    "time_display": "settings_update_time_display",
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
    security_alert = _find_latest_settings_test_event(logs, SETTINGS_TEST_EVENTS["security_alert"])
    return SettingsTestHistoryResponse(cloudflare=cloudflare, security_alert=security_alert)


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

    existing_telegram_bot_token = await repo.get("security_alert_telegram_bot_token")
    effective_telegram_bot_token = request.telegram_bot_token or existing_telegram_bot_token or ""
    existing_pagerduty_routing_key = await repo.get("security_alert_pagerduty_routing_key")
    effective_pagerduty_routing_key = request.pagerduty_routing_key or existing_pagerduty_routing_key or ""
    existing_email_password = await repo.get("security_alert_email_password")
    effective_email_password = request.email_password or existing_email_password or ""

    if request.enabled:
        if request.provider == "telegram":
            if not effective_telegram_bot_token or not request.telegram_chat_id:
                raise HTTPException(status_code=422, detail="Telegram bot token과 chat id가 필요합니다")
        elif request.provider == "pagerduty":
            if not effective_pagerduty_routing_key:
                raise HTTPException(status_code=422, detail="PagerDuty routing key가 필요합니다")
        elif request.provider == "email":
            if not request.email_host or not request.email_from or not request.email_recipients:
                raise HTTPException(status_code=422, detail="SMTP host, 발신자, 수신자 설정이 필요합니다")
            if request.email_username and not effective_email_password:
                raise HTTPException(status_code=422, detail="SMTP 비밀번호가 필요합니다")
        elif not request.webhook_url:
            raise HTTPException(status_code=422, detail="Webhook URL이 필요합니다")

    await repo.set(
        "security_alerts_enabled",
        "true" if request.enabled else "false",
    )
    await repo.set(
        "security_alert_provider",
        request.provider,
    )
    await repo.set(
        "security_alert_webhook_url",
        request.webhook_url or None,
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
    )


def _find_latest_settings_test_event(
    logs: list[AuditLogModel],
    event_name: str,
) -> SettingsTestHistoryItemResponse:
    for log in logs:
        detail = log.detail or {}
        if detail.get("event") != event_name:
            continue
        success = detail.get("success")
        return SettingsTestHistoryItemResponse(
            last_event=event_name,
            last_success=success if isinstance(success, bool) else None,
            last_message=detail.get("message") if isinstance(detail.get("message"), str) else None,
            last_detail=detail.get("detail") if isinstance(detail.get("detail"), str) else None,
            last_provider=detail.get("provider") if isinstance(detail.get("provider"), str) else None,
            last_created_at=log.created_at,
        )
    return SettingsTestHistoryItemResponse()


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


def _cloudflare_summary(status: CloudflareSettingsStatusResponse) -> dict[str, object]:
    return {
        "enabled": status.enabled,
        "configured": status.configured,
        "zone_id": status.zone_id,
        "record_target": status.record_target,
        "proxied": status.proxied,
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
        "provider": response.provider,
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

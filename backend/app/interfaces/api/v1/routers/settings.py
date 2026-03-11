from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.dependencies import get_current_user, require_admin
from app.interfaces.api.v1.schemas.settings_schemas import (
    CloudflareSettingsStatusResponse,
    CloudflareSettingsUpdateRequest,
    LoginDefenseSettingsResponse,
    LoginDefenseSettingsUpdateRequest,
    SecurityAlertSettingsResponse,
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


@router.put("/cloudflare", response_model=CloudflareSettingsStatusResponse, summary="Cloudflare 설정 저장")
async def update_cloudflare_settings(
    request: CloudflareSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)

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
    return CloudflareClient.from_db_settings(db_settings).get_status()


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
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    await repo.set("display_timezone", request.display_timezone)
    return _build_time_display_response(request.display_timezone)


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
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
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
    return await _build_upstream_security_response(repo)


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
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
    existing_turnstile_secret = await repo.get("login_turnstile_secret_key")
    effective_turnstile_secret = request.turnstile_secret_key or existing_turnstile_secret or ""

    if request.turnstile_enabled and (not request.turnstile_site_key or not effective_turnstile_secret):
        raise HTTPException(status_code=422, detail="Turnstile site key와 secret key가 필요합니다")

    await repo.set(
        "login_suspicious_block_enabled",
        "true" if request.suspicious_block_enabled else "false",
    )
    await repo.set(
        "login_suspicious_trusted_networks",
        "\n".join(request.suspicious_trusted_networks) or None,
    )
    await repo.set(
        "login_turnstile_enabled",
        "true" if request.turnstile_enabled else "false",
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
    return await _build_login_defense_response(repo)


@router.get("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 조회")
async def get_security_alert_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    repo = SQLiteSystemSettingsRepository(db)
    return await _build_security_alert_response(repo)


@router.put("/security-alerts", response_model=SecurityAlertSettingsResponse, summary="보안 알림 설정 저장")
async def update_security_alert_settings(
    request: SecurityAlertSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    repo = SQLiteSystemSettingsRepository(db)
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
    return await _build_security_alert_response(repo)


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
        turnstile_enabled=await _get_bool_setting(repo, "login_turnstile_enabled", default=False),
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


def _split_domain_suffixes(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def _split_networks(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]

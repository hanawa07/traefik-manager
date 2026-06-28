from app.core.certificate_diagnostics import (
    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD_KEY,
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_KEY,
    build_certificate_diagnostics_settings,
)
from app.core.config import settings
from app.domain.proxy.value_objects.upstream import normalize_domain_suffixes
from app.domain.proxy.value_objects.upstream_security_presets import (
    get_upstream_security_preset,
    infer_upstream_security_preset_key,
    list_upstream_security_presets,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import SQLiteSystemSettingsRepository
from app.interfaces.api.v1.routers.settings_security_alert_helpers import (
    SECURITY_ALERT_EVENTS,
    SECURITY_ALERT_PROVIDERS,
    build_change_alert_event_routes,
    build_security_alert_event_routes,
)
from app.interfaces.api.v1.routers.settings_value_helpers import (
    get_bool_setting,
    get_int_setting,
    get_turnstile_mode,
    split_domain_suffixes,
    split_networks,
)
from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    LoginDefenseSettingsResponse,
    SecurityAlertSettingsResponse,
    TraefikDashboardSettingsResponse,
    UpstreamSecuritySettingsResponse,
    UpstreamSecurityPresetResponse,
    normalize_trusted_networks,
)


async def build_traefik_dashboard_response(
    repo: SQLiteSystemSettingsRepository,
) -> TraefikDashboardSettingsResponse:
    enabled = await get_bool_setting(
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


async def build_certificate_diagnostics_response(
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


async def build_upstream_security_response(
    repo: SQLiteSystemSettingsRepository,
) -> UpstreamSecuritySettingsResponse:
    dns_strict_mode = await get_bool_setting(repo, "upstream_dns_strict_mode", default=False)
    allowlist_enabled = await get_bool_setting(repo, "upstream_allowlist_enabled", default=False)
    allow_docker_service_names = await get_bool_setting(
        repo,
        "upstream_allow_docker_service_names",
        default=True,
    )
    allow_private_networks = await get_bool_setting(
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
            split_domain_suffixes(await repo.get("upstream_allowed_domain_suffixes"))
        ),
        allow_docker_service_names=allow_docker_service_names,
        allow_private_networks=allow_private_networks,
    )


async def build_login_defense_response(
    repo: SQLiteSystemSettingsRepository,
) -> LoginDefenseSettingsResponse:
    turnstile_secret_key = await repo.get("login_turnstile_secret_key")
    turnstile_mode = await get_turnstile_mode(repo)
    return LoginDefenseSettingsResponse(
        max_failed_attempts=settings.LOGIN_MAX_FAILED_ATTEMPTS,
        failure_window_minutes=settings.LOGIN_FAILURE_WINDOW_MINUTES,
        lockout_minutes=settings.LOGIN_LOCKOUT_MINUTES,
        suspicious_window_minutes=settings.LOGIN_SUSPICIOUS_WINDOW_MINUTES,
        suspicious_failure_count=settings.LOGIN_SUSPICIOUS_FAILURE_COUNT,
        suspicious_username_count=settings.LOGIN_SUSPICIOUS_USERNAME_COUNT,
        suspicious_block_minutes=settings.LOGIN_SUSPICIOUS_BLOCK_MINUTES,
        suspicious_block_enabled=await get_bool_setting(
            repo,
            "login_suspicious_block_enabled",
            default=True,
        ),
        suspicious_trusted_networks=normalize_trusted_networks(
            split_networks(await repo.get("login_suspicious_trusted_networks"))
        ),
        suspicious_block_escalation_enabled=await get_bool_setting(
            repo,
            "login_suspicious_block_escalation_enabled",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED,
        ),
        suspicious_block_escalation_window_minutes=await get_int_setting(
            repo,
            "login_suspicious_block_escalation_window_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES,
        ),
        suspicious_block_escalation_multiplier=await get_int_setting(
            repo,
            "login_suspicious_block_escalation_multiplier",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER,
        ),
        suspicious_block_max_minutes=await get_int_setting(
            repo,
            "login_suspicious_block_max_minutes",
            default=settings.LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES,
        ),
        turnstile_mode=turnstile_mode,
        turnstile_enabled=turnstile_mode != "off",
        turnstile_site_key=await repo.get("login_turnstile_site_key"),
        turnstile_secret_key_configured=bool(turnstile_secret_key),
    )


async def build_security_alert_response(
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
        enabled=await get_bool_setting(
            repo,
            "security_alerts_enabled",
            default=False,
        ),
        change_alerts_enabled=await get_bool_setting(
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
        email_recipients=split_networks(await repo.get("security_alert_email_recipients")),
        timeout_seconds=settings.SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS,
        alert_events=SECURITY_ALERT_EVENTS,
        event_routes=await build_security_alert_event_routes(repo),
        change_event_routes=await build_change_alert_event_routes(repo),
    )

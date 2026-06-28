from app.interfaces.api.v1.schemas.settings_schemas import (
    CertificateDiagnosticsSettingsResponse,
    CloudflareSettingsStatusResponse,
    LoginDefenseSettingsResponse,
    SecurityAlertSettingsResponse,
    TraefikDashboardSettingsResponse,
    UpstreamSecuritySettingsResponse,
)


def cloudflare_summary(status: CloudflareSettingsStatusResponse | dict[str, object]) -> dict[str, object]:
    if isinstance(status, dict):
        status = CloudflareSettingsStatusResponse.model_validate(status)

    return {
        "enabled": status.enabled,
        "configured": status.configured,
        "zone_count": status.zone_count,
        "zones": [
            {
                "zone_id": zone.zone_id,
                "zone_name": zone.zone_name,
                "record_target": zone.record_target,
                "proxied": zone.proxied,
            }
            for zone in status.zones
        ],
    }


def traefik_dashboard_summary(response: TraefikDashboardSettingsResponse) -> dict[str, object]:
    return {
        "enabled": response.enabled,
        "configured": response.configured,
        "domain": response.domain,
        "auth_username": response.auth_username,
        "auth_password_configured": response.auth_password_configured,
    }


def certificate_diagnostics_summary(response: CertificateDiagnosticsSettingsResponse) -> dict[str, object]:
    return {
        "auto_check_interval_minutes": response.auto_check_interval_minutes,
        "repeat_alert_threshold": response.repeat_alert_threshold,
        "repeat_alert_window_minutes": response.repeat_alert_window_minutes,
        "repeat_alert_cooldown_minutes": response.repeat_alert_cooldown_minutes,
    }


def upstream_security_summary(response: UpstreamSecuritySettingsResponse) -> dict[str, object]:
    return {
        "preset_key": response.preset_key,
        "dns_strict_mode": response.dns_strict_mode,
        "allowlist_enabled": response.allowlist_enabled,
        "allowed_domain_suffixes_count": len(response.allowed_domain_suffixes),
        "allow_docker_service_names": response.allow_docker_service_names,
        "allow_private_networks": response.allow_private_networks,
    }


def login_defense_summary(response: LoginDefenseSettingsResponse) -> dict[str, object]:
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


def security_alert_summary(response: SecurityAlertSettingsResponse) -> dict[str, object]:
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

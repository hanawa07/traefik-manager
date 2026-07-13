import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

export function createDefaultSecurityAlertForm(): SecurityAlertSettingsInput {
  return {
    enabled: false,
    change_alerts_enabled: false,
    manager_health_monitoring_enabled: true,
    manager_health_alert_cooldown_minutes: 60,
    external_watchdog_stale_minutes: 10,
    manager_http_error_monitoring_enabled: false,
    manager_http_error_window_minutes: 15,
    manager_http_not_found_threshold: 20,
    manager_http_server_error_threshold: 1,
    provider: "generic",
    webhook_url: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
    pagerduty_routing_key: "",
    email_host: "",
    email_port: 587,
    email_security: "starttls",
    email_username: "",
    email_password: "",
    email_from: "",
    email_recipients: [],
    event_routes: {
      login_locked: "default",
      login_suspicious: "default",
      login_blocked_ip: "default",
    },
    change_event_routes: {
      settings_change: "default",
      service_change: "default",
      redirect_change: "default",
      middleware_change: "default",
      user_change: "default",
      certificate_status_change: "default",
      certificate_preflight_failure: "default",
      manager_health: "default",
      rollback: "default",
    },
  };
}

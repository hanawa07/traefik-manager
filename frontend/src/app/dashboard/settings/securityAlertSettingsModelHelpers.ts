import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { createDefaultSecurityAlertForm } from "@/features/settings/lib/settingsDefaults";

export function createSecurityAlertFormFromSettings(
  settings?: SecurityAlertSettingsStatus,
): SecurityAlertSettingsInput {
  const defaults = createDefaultSecurityAlertForm();

  return {
    enabled: settings?.enabled ?? defaults.enabled,
    change_alerts_enabled: settings?.change_alerts_enabled ?? defaults.change_alerts_enabled,
    manager_health_monitoring_enabled:
      settings?.manager_health_monitoring_enabled ?? defaults.manager_health_monitoring_enabled,
    manager_health_alert_cooldown_minutes:
      settings?.manager_health_alert_cooldown_minutes ??
      defaults.manager_health_alert_cooldown_minutes,
    external_watchdog_stale_minutes:
      settings?.external_watchdog_stale_minutes ?? defaults.external_watchdog_stale_minutes,
    automatic_retry_delay_warning_minutes:
      settings?.automatic_retry_delay_warning_minutes ??
      defaults.automatic_retry_delay_warning_minutes,
    manager_http_error_monitoring_enabled:
      settings?.manager_http_error_monitoring_enabled ??
      defaults.manager_http_error_monitoring_enabled,
    manager_http_error_window_minutes:
      settings?.manager_http_error_window_minutes ??
      defaults.manager_http_error_window_minutes,
    manager_http_not_found_threshold:
      settings?.manager_http_not_found_threshold ??
      defaults.manager_http_not_found_threshold,
    manager_http_server_error_threshold:
      settings?.manager_http_server_error_threshold ??
      defaults.manager_http_server_error_threshold,
    manager_http_excluded_paths:
      settings?.manager_http_excluded_paths ?? defaults.manager_http_excluded_paths,
    provider: settings?.provider ?? defaults.provider,
    webhook_url: settings?.webhook_url ?? defaults.webhook_url,
    telegram_bot_token: defaults.telegram_bot_token,
    telegram_chat_id: settings?.telegram_chat_id ?? defaults.telegram_chat_id,
    pagerduty_routing_key: defaults.pagerduty_routing_key,
    email_host: settings?.email_host ?? defaults.email_host,
    email_port: settings?.email_port ?? defaults.email_port,
    email_security: settings?.email_security ?? defaults.email_security,
    email_username: settings?.email_username ?? defaults.email_username,
    email_password: defaults.email_password,
    email_from: settings?.email_from ?? defaults.email_from,
    email_recipients: settings?.email_recipients ?? defaults.email_recipients,
    event_routes: { ...defaults.event_routes, ...settings?.event_routes },
    change_event_routes: { ...defaults.change_event_routes, ...settings?.change_event_routes },
  };
}

export function buildSecurityAlertSettingsPayload(
  formValue: SecurityAlertSettingsInput,
): SecurityAlertSettingsInput {
  return {
    enabled: formValue.enabled,
    change_alerts_enabled: formValue.change_alerts_enabled,
    manager_health_monitoring_enabled: formValue.manager_health_monitoring_enabled,
    manager_health_alert_cooldown_minutes: formValue.manager_health_alert_cooldown_minutes,
    external_watchdog_stale_minutes: formValue.external_watchdog_stale_minutes,
    automatic_retry_delay_warning_minutes: formValue.automatic_retry_delay_warning_minutes,
    manager_http_error_monitoring_enabled: formValue.manager_http_error_monitoring_enabled,
    manager_http_error_window_minutes: formValue.manager_http_error_window_minutes,
    manager_http_not_found_threshold: formValue.manager_http_not_found_threshold,
    manager_http_server_error_threshold: formValue.manager_http_server_error_threshold,
    manager_http_excluded_paths: formValue.manager_http_excluded_paths,
    provider: formValue.provider,
    webhook_url: formValue.webhook_url.trim(),
    telegram_bot_token: formValue.telegram_bot_token.trim(),
    telegram_chat_id: formValue.telegram_chat_id.trim(),
    pagerduty_routing_key: formValue.pagerduty_routing_key.trim(),
    email_host: formValue.email_host.trim(),
    email_port: formValue.email_port,
    email_security: formValue.email_security,
    email_username: formValue.email_username.trim(),
    email_password: formValue.email_password.trim(),
    email_from: formValue.email_from.trim(),
    email_recipients: formValue.email_recipients,
    event_routes: formValue.event_routes,
    change_event_routes: formValue.change_event_routes,
  };
}

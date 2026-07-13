import apiClient from "@/shared/lib/apiClient";

import type { SettingsActionTestResult } from "./settingsSharedTypes";

export type SecurityAlertRouteEvent = "login_locked" | "login_suspicious" | "login_blocked_ip";
export type SecurityAlertRouteTarget = "default" | "disabled" | "telegram" | "pagerduty" | "email";
export type SecurityAlertEventRoutes = Record<SecurityAlertRouteEvent, SecurityAlertRouteTarget>;
export type ChangeAlertRouteEvent =
  | "settings_change"
  | "service_change"
  | "redirect_change"
  | "middleware_change"
  | "user_change"
  | "certificate_status_change"
  | "certificate_preflight_failure"
  | "manager_health"
  | "rollback";
export type ChangeAlertEventRoutes = Record<ChangeAlertRouteEvent, SecurityAlertRouteTarget>;

export interface SecurityAlertSettingsStatus {
  enabled: boolean;
  change_alerts_enabled: boolean;
  manager_health_monitoring_enabled: boolean;
  manager_health_alert_cooldown_minutes: number;
  external_watchdog_stale_minutes: number;
  manager_http_error_monitoring_enabled: boolean;
  manager_http_error_window_minutes: number;
  manager_http_not_found_threshold: number;
  manager_http_server_error_threshold: number;
  manager_http_excluded_paths: string[];
  provider: "generic" | "slack" | "discord" | "telegram" | "teams" | "pagerduty" | "email";
  webhook_url: string | null;
  telegram_bot_token_configured: boolean;
  telegram_chat_id: string | null;
  pagerduty_routing_key_configured: boolean;
  email_host: string | null;
  email_port: number;
  email_security: "none" | "starttls" | "ssl";
  email_username: string | null;
  email_password_configured: boolean;
  email_from: string | null;
  email_recipients: string[];
  timeout_seconds: number;
  alert_events: string[];
  event_routes: SecurityAlertEventRoutes;
  change_event_routes: ChangeAlertEventRoutes;
}

export interface SecurityAlertSettingsInput {
  enabled: boolean;
  change_alerts_enabled: boolean;
  manager_health_monitoring_enabled: boolean;
  manager_health_alert_cooldown_minutes: number;
  external_watchdog_stale_minutes: number;
  manager_http_error_monitoring_enabled: boolean;
  manager_http_error_window_minutes: number;
  manager_http_not_found_threshold: number;
  manager_http_server_error_threshold: number;
  manager_http_excluded_paths: string[];
  provider: "generic" | "slack" | "discord" | "telegram" | "teams" | "pagerduty" | "email";
  webhook_url: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  pagerduty_routing_key: string;
  email_host: string;
  email_port: number;
  email_security: "none" | "starttls" | "ssl";
  email_username: string;
  email_password: string;
  email_from: string;
  email_recipients: string[];
  event_routes: SecurityAlertEventRoutes;
  change_event_routes: ChangeAlertEventRoutes;
}

export interface ManagerHttpErrorPreviewInput {
  window_minutes: number;
  excluded_paths: string[];
}

export interface ManagerHttpExcludedPathPreview {
  path: string;
  not_found_count: number;
  server_error_count: number;
  last_seen_at: string | null;
}

export interface ManagerHttpErrorPreview {
  available: boolean;
  message: string;
  window_hours: number;
  window_minutes: number;
  checked_at: string;
  observed_since: string | null;
  sample_coverage_percent: number;
  peak_not_found_count: number;
  peak_server_error_count: number;
  recommended_not_found_threshold: number;
  recommended_server_error_threshold: number;
  excluded_paths: ManagerHttpExcludedPathPreview[];
}

export const securityAlertSettingsApi = {
  getSecurityAlertSettings: async (): Promise<SecurityAlertSettingsStatus> => {
    const res = await apiClient.get<SecurityAlertSettingsStatus>("/settings/security-alerts");
    return res.data;
  },

  updateSecurityAlertSettings: async (
    payload: SecurityAlertSettingsInput,
  ): Promise<SecurityAlertSettingsStatus> => {
    const res = await apiClient.put<SecurityAlertSettingsStatus>("/settings/security-alerts", payload);
    return res.data;
  },

  testSecurityAlertSettings: async (): Promise<SettingsActionTestResult> => {
    const res = await apiClient.post<SettingsActionTestResult>("/settings/security-alerts/test");
    return res.data;
  },

  previewManagerHttpErrors: async (
    payload: ManagerHttpErrorPreviewInput,
  ): Promise<ManagerHttpErrorPreview> => {
    const res = await apiClient.post<ManagerHttpErrorPreview>(
      "/docker/http-errors/preview",
      payload,
    );
    return res.data;
  },
};

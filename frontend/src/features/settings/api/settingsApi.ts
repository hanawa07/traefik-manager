import apiClient from "@/shared/lib/apiClient";

export interface CloudflareSettingsStatus {
  enabled: boolean;
  configured: boolean;
  zone_id: string | null;
  record_target: string | null;
  proxied: boolean;
  message: string;
}

export interface BackupServiceItem {
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
  https_redirect_enabled: boolean;
  auth_enabled: boolean;
  allowed_ips: string[];
  rate_limit_average: number | null;
  rate_limit_burst: number | null;
  custom_headers: Record<string, string>;
  frame_policy: "deny" | "sameorigin" | "off";
  basic_auth_users: string[];
  middleware_template_ids: string[];
  authentik_provider_id?: string | null;
  authentik_app_slug?: string | null;
  authentik_group_id?: string | null;
  authentik_group_name?: string | null;
  authentik_policy_id?: string | null;
  authentik_policy_binding_id?: string | null;
  cloudflare_record_id?: string | null;
}

export interface BackupRedirectHostItem {
  domain: string;
  target_url: string;
  permanent: boolean;
  tls_enabled: boolean;
}

export interface BackupPayload {
  services: BackupServiceItem[];
  redirect_hosts: BackupRedirectHostItem[];
}

export interface BackupImportResult {
  mode: "merge" | "overwrite";
  created_services: number;
  updated_services: number;
  deleted_services: number;
  created_redirects: number;
  updated_redirects: number;
  deleted_redirects: number;
}

export interface BackupValidateResult {
  valid: boolean;
  service_count: number;
  redirect_count: number;
  warning_count: number;
  warnings: string[];
}

export interface BackupPreviewItem {
  domain: string;
  name: string | null;
}

export interface BackupPreviewGroup {
  creates: BackupPreviewItem[];
  updates: BackupPreviewItem[];
  deletes: BackupPreviewItem[];
}

export interface BackupPreviewResult {
  mode: "merge" | "overwrite";
  service_count: number;
  redirect_count: number;
  warning_count: number;
  warnings: string[];
  services: BackupPreviewGroup;
  redirect_hosts: BackupPreviewGroup;
}

export interface CloudflareSettingsInput {
  api_token: string;
  zone_id: string;
  record_target: string;
  proxied: boolean;
}

export interface TimeDisplaySettingsStatus {
  display_timezone: string;
  display_timezone_name: string;
  display_timezone_label: string;
  storage_timezone: string;
  server_timezone_name: string;
  server_timezone_label: string;
  server_timezone_offset: string;
  server_time_iso: string;
}

export interface TimeDisplaySettingsInput {
  display_timezone: string;
}

export interface UpstreamSecuritySettingsStatus {
  preset_key: string;
  preset_name: string;
  preset_description: string;
  available_presets: UpstreamSecurityPreset[];
  dns_strict_mode: boolean;
  allowlist_enabled: boolean;
  allowed_domain_suffixes: string[];
  allow_docker_service_names: boolean;
  allow_private_networks: boolean;
}

export interface UpstreamSecurityPreset {
  key: string;
  name: string;
  description: string;
  dns_strict_mode: boolean;
  allowlist_enabled: boolean;
  allow_docker_service_names: boolean;
  allow_private_networks: boolean;
}

export interface UpstreamSecuritySettingsInput {
  dns_strict_mode: boolean;
  allowlist_enabled: boolean;
  allowed_domain_suffixes: string[];
  allow_docker_service_names: boolean;
  allow_private_networks: boolean;
}

export interface LoginDefenseSettingsStatus {
  max_failed_attempts: number;
  failure_window_minutes: number;
  lockout_minutes: number;
  suspicious_window_minutes: number;
  suspicious_failure_count: number;
  suspicious_username_count: number;
  suspicious_block_minutes: number;
  suspicious_block_enabled: boolean;
  suspicious_trusted_networks: string[];
  suspicious_block_escalation_enabled: boolean;
  suspicious_block_escalation_window_minutes: number;
  suspicious_block_escalation_multiplier: number;
  suspicious_block_max_minutes: number;
  turnstile_mode: "off" | "always" | "risk_based";
  turnstile_enabled: boolean;
  turnstile_site_key: string | null;
  turnstile_secret_key_configured: boolean;
}

export interface LoginDefenseSettingsInput {
  suspicious_block_enabled: boolean;
  suspicious_trusted_networks: string[];
  suspicious_block_escalation_enabled: boolean;
  suspicious_block_escalation_window_minutes: number;
  suspicious_block_escalation_multiplier: number;
  suspicious_block_max_minutes: number;
  turnstile_mode: "off" | "always" | "risk_based";
  turnstile_site_key: string;
  turnstile_secret_key: string;
}

export type SecurityAlertRouteEvent = "login_locked" | "login_suspicious" | "login_blocked_ip";
export type SecurityAlertRouteTarget = "default" | "disabled" | "telegram" | "pagerduty" | "email";
export type SecurityAlertEventRoutes = Record<SecurityAlertRouteEvent, SecurityAlertRouteTarget>;
export type ChangeAlertRouteEvent =
  | "settings_change"
  | "service_change"
  | "redirect_change"
  | "middleware_change"
  | "user_change"
  | "rollback";
export type ChangeAlertEventRoutes = Record<ChangeAlertRouteEvent, SecurityAlertRouteTarget>;

export interface SecurityAlertSettingsStatus {
  enabled: boolean;
  change_alerts_enabled: boolean;
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

export interface SettingsActionTestResult {
  success: boolean;
  message: string;
  detail: string | null;
  provider: string | null;
}

export interface SettingsRollbackActionResult {
  success: boolean;
  message: string;
  resource_name: string;
  event: string;
}

export interface SettingsTestHistoryItem {
  last_event: string | null;
  last_success: boolean | null;
  last_message: string | null;
  last_detail: string | null;
  last_provider: string | null;
  last_created_at: string | null;
}

export interface SettingsTestHistoryStatus {
  cloudflare: SettingsTestHistoryItem;
  security_alert: SettingsTestHistoryItem;
}

export const settingsApi = {
  getCloudflareStatus: async (): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.get<CloudflareSettingsStatus>("/settings/cloudflare");
    return res.data;
  },

  getTimeDisplaySettings: async (): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.get<TimeDisplaySettingsStatus>("/settings/time-display");
    return res.data;
  },

  getUpstreamSecuritySettings: async (): Promise<UpstreamSecuritySettingsStatus> => {
    const res = await apiClient.get<UpstreamSecuritySettingsStatus>("/settings/upstream-security");
    return res.data;
  },

  getLoginDefenseSettings: async (): Promise<LoginDefenseSettingsStatus> => {
    const res = await apiClient.get<LoginDefenseSettingsStatus>("/settings/login-defense");
    return res.data;
  },

  getSecurityAlertSettings: async (): Promise<SecurityAlertSettingsStatus> => {
    const res = await apiClient.get<SecurityAlertSettingsStatus>("/settings/security-alerts");
    return res.data;
  },

  getSettingsTestHistory: async (): Promise<SettingsTestHistoryStatus> => {
    const res = await apiClient.get<SettingsTestHistoryStatus>("/settings/test-history");
    return res.data;
  },

  updateCloudflareSettings: async (payload: CloudflareSettingsInput): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.put<CloudflareSettingsStatus>("/settings/cloudflare", payload);
    return res.data;
  },

  testCloudflareConnection: async (): Promise<SettingsActionTestResult> => {
    const res = await apiClient.post<SettingsActionTestResult>("/settings/cloudflare/test");
    return res.data;
  },

  updateTimeDisplaySettings: async (payload: TimeDisplaySettingsInput): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.put<TimeDisplaySettingsStatus>("/settings/time-display", payload);
    return res.data;
  },

  updateUpstreamSecuritySettings: async (
    payload: UpstreamSecuritySettingsInput,
  ): Promise<UpstreamSecuritySettingsStatus> => {
    const res = await apiClient.put<UpstreamSecuritySettingsStatus>("/settings/upstream-security", payload);
    return res.data;
  },

  updateLoginDefenseSettings: async (payload: LoginDefenseSettingsInput): Promise<LoginDefenseSettingsStatus> => {
    const res = await apiClient.put<LoginDefenseSettingsStatus>("/settings/login-defense", payload);
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

  rollbackSettingsChange: async (auditLogId: string): Promise<SettingsRollbackActionResult> => {
    const res = await apiClient.post<SettingsRollbackActionResult>(`/settings/rollback/${auditLogId}`);
    return res.data;
  },

  exportBackup: async (): Promise<BackupPayload> => {
    const res = await apiClient.get<BackupPayload>("/backup/export");
    return res.data;
  },

  importBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupImportResult> => {
    const res = await apiClient.post<BackupImportResult>("/backup/import", { mode, data });
    return res.data;
  },

  validateBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupValidateResult> => {
    const res = await apiClient.post<BackupValidateResult>("/backup/validate", { mode, data });
    return res.data;
  },

  previewBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupPreviewResult> => {
    const res = await apiClient.post<BackupPreviewResult>("/backup/preview", { mode, data });
    return res.data;
  },
};

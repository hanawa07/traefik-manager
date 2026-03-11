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
  turnstile_mode: "off" | "always" | "risk_based";
  turnstile_enabled: boolean;
  turnstile_site_key: string | null;
  turnstile_secret_key_configured: boolean;
}

export interface LoginDefenseSettingsInput {
  suspicious_block_enabled: boolean;
  suspicious_trusted_networks: string[];
  turnstile_mode: "off" | "always" | "risk_based";
  turnstile_site_key: string;
  turnstile_secret_key: string;
}

export interface SecurityAlertSettingsStatus {
  enabled: boolean;
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
}

export interface SecurityAlertSettingsInput {
  enabled: boolean;
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

  updateCloudflareSettings: async (payload: CloudflareSettingsInput): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.put<CloudflareSettingsStatus>("/settings/cloudflare", payload);
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
};

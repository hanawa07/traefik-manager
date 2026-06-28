import apiClient from "@/shared/lib/apiClient";

export interface TraefikDashboardSettingsStatus {
  enabled: boolean;
  configured: boolean;
  domain: string | null;
  public_url: string | null;
  auth_username: string | null;
  auth_password_configured: boolean;
  message: string;
}

export interface TraefikDashboardSettingsInput {
  enabled: boolean;
  domain: string;
  auth_username: string;
  auth_password: string;
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

export interface CertificateDiagnosticsSettingsStatus {
  auto_check_interval_minutes: number;
  repeat_alert_threshold: number;
  repeat_alert_window_minutes: number;
  repeat_alert_cooldown_minutes: number;
}

export interface CertificateDiagnosticsSettingsInput {
  auto_check_interval_minutes: number;
  repeat_alert_threshold: number;
  repeat_alert_window_minutes: number;
  repeat_alert_cooldown_minutes: number;
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

export const policySettingsApi = {
  getTimeDisplaySettings: async (): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.get<TimeDisplaySettingsStatus>("/settings/time-display");
    return res.data;
  },

  getCertificateDiagnosticsSettings: async (): Promise<CertificateDiagnosticsSettingsStatus> => {
    const res = await apiClient.get<CertificateDiagnosticsSettingsStatus>("/settings/certificate-diagnostics");
    return res.data;
  },

  getTraefikDashboardSettings: async (): Promise<TraefikDashboardSettingsStatus> => {
    const res = await apiClient.get<TraefikDashboardSettingsStatus>("/settings/traefik-dashboard");
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

  updateTimeDisplaySettings: async (payload: TimeDisplaySettingsInput): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.put<TimeDisplaySettingsStatus>("/settings/time-display", payload);
    return res.data;
  },

  updateCertificateDiagnosticsSettings: async (
    payload: CertificateDiagnosticsSettingsInput,
  ): Promise<CertificateDiagnosticsSettingsStatus> => {
    const res = await apiClient.put<CertificateDiagnosticsSettingsStatus>(
      "/settings/certificate-diagnostics",
      payload,
    );
    return res.data;
  },

  updateTraefikDashboardSettings: async (
    payload: TraefikDashboardSettingsInput,
  ): Promise<TraefikDashboardSettingsStatus> => {
    const res = await apiClient.put<TraefikDashboardSettingsStatus>("/settings/traefik-dashboard", payload);
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
};

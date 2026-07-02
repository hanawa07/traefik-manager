import apiClient from "@/shared/lib/apiClient";

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

export const loginDefenseSettingsApi = {
  getLoginDefenseSettings: async (): Promise<LoginDefenseSettingsStatus> => {
    const res = await apiClient.get<LoginDefenseSettingsStatus>("/settings/login-defense");
    return res.data;
  },

  updateLoginDefenseSettings: async (
    payload: LoginDefenseSettingsInput,
  ): Promise<LoginDefenseSettingsStatus> => {
    const res = await apiClient.put<LoginDefenseSettingsStatus>(
      "/settings/login-defense",
      payload,
    );
    return res.data;
  },
};

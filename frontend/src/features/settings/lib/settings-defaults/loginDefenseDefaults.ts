import type { LoginDefenseSettingsInput } from "@/features/settings/api/settingsApi";

export type LoginDefenseForm = LoginDefenseSettingsInput & {
  suspicious_trusted_networks_text: string;
};

export function createDefaultLoginDefenseForm(): LoginDefenseForm {
  return {
    suspicious_block_enabled: true,
    suspicious_trusted_networks: [],
    suspicious_trusted_networks_text: "",
    suspicious_block_escalation_enabled: false,
    suspicious_block_escalation_window_minutes: 1440,
    suspicious_block_escalation_multiplier: 2,
    suspicious_block_max_minutes: 1440,
    turnstile_mode: "off",
    turnstile_site_key: "",
    turnstile_secret_key: "",
  };
}

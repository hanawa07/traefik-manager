import type { TraefikDashboardSettingsInput } from "@/features/settings/api/settingsApi";

export function createDefaultTraefikDashboardForm(): TraefikDashboardSettingsInput {
  return {
    enabled: false,
    domain: "",
    auth_username: "",
    auth_password: "",
  };
}

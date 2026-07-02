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

export const traefikDashboardSettingsApi = {
  getTraefikDashboardSettings: async (): Promise<TraefikDashboardSettingsStatus> => {
    const res = await apiClient.get<TraefikDashboardSettingsStatus>(
      "/settings/traefik-dashboard",
    );
    return res.data;
  },

  updateTraefikDashboardSettings: async (
    payload: TraefikDashboardSettingsInput,
  ): Promise<TraefikDashboardSettingsStatus> => {
    const res = await apiClient.put<TraefikDashboardSettingsStatus>(
      "/settings/traefik-dashboard",
      payload,
    );
    return res.data;
  },
};

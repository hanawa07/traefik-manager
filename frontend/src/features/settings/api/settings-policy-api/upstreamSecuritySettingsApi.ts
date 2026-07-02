import apiClient from "@/shared/lib/apiClient";

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

export const upstreamSecuritySettingsApi = {
  getUpstreamSecuritySettings: async (): Promise<UpstreamSecuritySettingsStatus> => {
    const res = await apiClient.get<UpstreamSecuritySettingsStatus>(
      "/settings/upstream-security",
    );
    return res.data;
  },

  updateUpstreamSecuritySettings: async (
    payload: UpstreamSecuritySettingsInput,
  ): Promise<UpstreamSecuritySettingsStatus> => {
    const res = await apiClient.put<UpstreamSecuritySettingsStatus>(
      "/settings/upstream-security",
      payload,
    );
    return res.data;
  },
};

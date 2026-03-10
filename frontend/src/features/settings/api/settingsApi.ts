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

export const settingsApi = {
  getCloudflareStatus: async (): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.get<CloudflareSettingsStatus>("/settings/cloudflare");
    return res.data;
  },

  updateCloudflareSettings: async (payload: CloudflareSettingsInput): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.put<CloudflareSettingsStatus>("/settings/cloudflare", payload);
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

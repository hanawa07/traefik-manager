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

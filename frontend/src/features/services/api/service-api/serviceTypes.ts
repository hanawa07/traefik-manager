export type AuthMode = "none" | "authentik" | "token";
export type FramePolicy = "deny" | "sameorigin" | "off";

export interface Service {
  id: string;
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  upstream_scheme: "http" | "https";
  skip_tls_verify: boolean;
  tls_enabled: boolean;
  https_redirect_enabled: boolean;
  auth_enabled: boolean;
  auth_mode: AuthMode;
  api_key: string | null;
  allowed_ips: string[];
  blocked_paths: string[];
  rate_limit_enabled: boolean;
  rate_limit_average: number | null;
  rate_limit_burst: number | null;
  custom_headers: Record<string, string>;
  frame_policy: FramePolicy;
  healthcheck_enabled: boolean;
  healthcheck_path: string;
  healthcheck_timeout_ms: number;
  healthcheck_expected_statuses: number[];
  basic_auth_enabled: boolean;
  basic_auth_user_count: number;
  basic_auth_usernames: string[];
  middleware_template_ids: string[];
  authentik_group_id: string | null;
  authentik_group_name: string | null;
  cloudflare_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BasicAuthCredential {
  username: string;
  password: string;
}

export interface ServiceCreate {
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  upstream_scheme: "http" | "https";
  skip_tls_verify: boolean;
  tls_enabled: boolean;
  https_redirect_enabled: boolean;
  auth_enabled?: boolean;
  auth_mode: AuthMode;
  api_key?: string | null;
  basic_auth_enabled: boolean;
  rate_limit_enabled?: boolean;
  allowed_ips: string[];
  blocked_paths: string[];
  rate_limit_average: number | null;
  rate_limit_burst: number | null;
  custom_headers: Record<string, string>;
  frame_policy: FramePolicy;
  healthcheck_enabled: boolean;
  healthcheck_path: string;
  healthcheck_timeout_ms: number;
  healthcheck_expected_statuses: number[];
  basic_auth_credentials?: BasicAuthCredential[];
  middleware_template_ids: string[];
  authentik_group_id?: string | null;
}

export interface ServiceUpdate {
  name?: string;
  upstream_host?: string;
  upstream_port?: number;
  upstream_scheme?: "http" | "https";
  skip_tls_verify?: boolean;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_enabled?: boolean;
  auth_mode?: AuthMode;
  api_key?: string | null;
  basic_auth_enabled?: boolean;
  rate_limit_enabled?: boolean;
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
  frame_policy?: FramePolicy;
  healthcheck_enabled?: boolean;
  healthcheck_path?: string;
  healthcheck_timeout_ms?: number;
  healthcheck_expected_statuses?: number[];
  allowed_ips?: string[];
  blocked_paths?: string[];
  basic_auth_credentials?: BasicAuthCredential[];
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
}

export interface AuthentikGroup {
  id: string;
  name: string;
}

export interface UpstreamHealth {
  service_id: string;
  domain: string;
  status: "up" | "down" | "unknown";
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  error_kind: string | null;
  checked_url: string;
  checked_at: string;
}

export interface ServiceGatewayDiagnosticCheck {
  key: string;
  label: string;
  status: "ok" | "warning" | "fail";
  message: string;
  details: Record<string, unknown>;
}

export interface ServiceGatewayDiagnosis {
  service_id: string;
  domain: string;
  status: "ok" | "warning" | "fail";
  summary: string;
  checked_at: string;
  checks: ServiceGatewayDiagnosticCheck[];
}

export interface ServiceGatewayNetworkConnectResult {
  service_id: string;
  domain: string;
  upstream_host: string;
  network: string;
  status: "connected" | "already_connected";
  message: string;
  upstream_networks: string[];
  checked_at: string;
}

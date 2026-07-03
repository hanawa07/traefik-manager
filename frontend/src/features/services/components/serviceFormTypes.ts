import type { AuthMode, FramePolicy } from "../api/serviceApi";

export interface ServiceFormDefaultValues {
  name?: string;
  domain?: string;
  upstream_host?: string;
  upstream_port?: number;
  upstream_scheme?: "http" | "https";
  skip_tls_verify?: boolean;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_mode?: AuthMode;
  api_key?: string | null;
  basic_auth_enabled?: boolean;
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
  allowed_ips?: string[];
  blocked_paths?: string[];
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
  frame_policy?: FramePolicy;
  healthcheck_enabled?: boolean;
  healthcheck_path?: string;
  healthcheck_timeout_ms?: number;
  healthcheck_expected_statuses?: number[];
  basic_auth_usernames?: string[];
}

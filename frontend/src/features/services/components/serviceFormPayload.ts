import type { ServiceCreate } from "../api/serviceApi";
import type { ServiceFormData, ServiceFormDefaultValues } from "./serviceFormSchema";
import {
  parseAllowedIps,
  parseBlockedPaths,
  parseHealthcheckExpectedStatuses,
} from "./serviceFormUtils";

export function createServiceFormDefaultValues(defaultValues?: ServiceFormDefaultValues): ServiceFormData {
  const headerEntries = Object.entries(defaultValues?.custom_headers || {}).map(([key, value]) => ({
    key,
    value,
  }));
  const basicAuthUsernames = defaultValues?.basic_auth_usernames;
  const basicAuthCredentials =
    basicAuthUsernames && basicAuthUsernames.length > 0
      ? basicAuthUsernames.map((username) => ({ username, password: "" }))
      : [{ username: "", password: "" }];

  return {
    name: defaultValues?.name || "",
    domain: defaultValues?.domain || "",
    upstream_host: defaultValues?.upstream_host || "",
    upstream_port: defaultValues?.upstream_port ?? 80,
    upstream_scheme: defaultValues?.upstream_scheme || "http",
    skip_tls_verify: defaultValues?.skip_tls_verify ?? false,
    tls_enabled: defaultValues?.tls_enabled ?? true,
    https_redirect_enabled: defaultValues?.https_redirect_enabled ?? true,
    auth_mode: defaultValues?.auth_mode || "none",
    api_key: defaultValues?.api_key || null,
    basic_auth_enabled: defaultValues?.basic_auth_enabled ?? false,
    middleware_template_ids: defaultValues?.middleware_template_ids || [],
    allowed_ips_input: defaultValues?.allowed_ips?.join("\n") || "",
    blocked_paths_input: defaultValues?.blocked_paths?.join("\n") || "",
    authentik_group_id: defaultValues?.authentik_group_id || "",
    basic_auth_credentials: basicAuthCredentials,
    rate_limit_enabled: defaultValues?.rate_limit_average != null && defaultValues?.rate_limit_burst != null,
    rate_limit_average: defaultValues?.rate_limit_average ?? undefined,
    rate_limit_burst: defaultValues?.rate_limit_burst ?? undefined,
    custom_headers: headerEntries.length > 0 ? headerEntries : [{ key: "", value: "" }],
    frame_policy: defaultValues?.frame_policy || "deny",
    healthcheck_enabled: defaultValues?.healthcheck_enabled ?? true,
    healthcheck_path: defaultValues?.healthcheck_path || "/",
    healthcheck_timeout_ms: defaultValues?.healthcheck_timeout_ms ?? 3000,
    healthcheck_expected_statuses_input: defaultValues?.healthcheck_expected_statuses?.join(", ") || "",
  };
}

export function buildServiceSubmitPayload(data: ServiceFormData): ServiceCreate {
  const customHeaders = data.custom_headers.reduce<Record<string, string>>((acc, item) => {
    const key = item.key.trim();
    const value = item.value.trim();
    if (!key) return acc;
    acc[key] = value;
    return acc;
  }, {});

  const basicAuthCredentials = data.basic_auth_credentials
    .map((item) => ({
      username: item.username.trim(),
      password: item.password,
    }))
    // 빈 비밀번호는 기존 해시 유지 또는 백엔드 검증 대상으로 전달한다.
    .filter((item) => item.username);

  return {
    name: data.name,
    domain: data.domain,
    upstream_host: data.upstream_host,
    upstream_port: data.upstream_port,
    upstream_scheme: data.upstream_scheme,
    skip_tls_verify: data.upstream_scheme === "https" ? data.skip_tls_verify : false,
    tls_enabled: data.tls_enabled,
    https_redirect_enabled: data.https_redirect_enabled,
    auth_mode: data.auth_mode,
    api_key: data.auth_mode === "token" ? data.api_key : null,
    basic_auth_enabled: data.basic_auth_enabled,
    middleware_template_ids: data.middleware_template_ids,
    rate_limit_enabled: data.rate_limit_enabled,
    allowed_ips: parseAllowedIps(data.allowed_ips_input),
    blocked_paths: parseBlockedPaths(data.blocked_paths_input),
    rate_limit_average: data.rate_limit_enabled ? data.rate_limit_average ?? null : null,
    rate_limit_burst: data.rate_limit_enabled ? data.rate_limit_burst ?? null : null,
    custom_headers: customHeaders,
    frame_policy: data.frame_policy,
    healthcheck_enabled: data.healthcheck_enabled,
    healthcheck_path: data.healthcheck_path.trim() || "/",
    healthcheck_timeout_ms: data.healthcheck_timeout_ms,
    healthcheck_expected_statuses: parseHealthcheckExpectedStatuses(data.healthcheck_expected_statuses_input),
    basic_auth_credentials: data.basic_auth_enabled ? basicAuthCredentials : [],
    authentik_group_id: data.auth_mode === "authentik" ? data.authentik_group_id || null : null,
  };
}

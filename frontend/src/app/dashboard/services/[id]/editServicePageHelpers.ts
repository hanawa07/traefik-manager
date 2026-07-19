import type { Service } from "@/features/services/api/serviceApi";
import type { ServiceFormDefaultValues } from "@/features/services/components/serviceFormSchema";

export function serviceToFormDefaultValues(service: Service): ServiceFormDefaultValues {
  return {
    name: service.name,
    domain: service.domain,
    upstream_host: service.upstream_host,
    upstream_port: service.upstream_port,
    routing_mode: service.routing_mode,
    upstream_scheme: service.upstream_scheme,
    skip_tls_verify: service.skip_tls_verify,
    tls_enabled: service.tls_enabled,
    https_redirect_enabled: service.https_redirect_enabled,
    auth_mode: service.auth_mode,
    api_key: service.api_key,
    basic_auth_enabled: service.basic_auth_enabled,
    middleware_template_ids: service.middleware_template_ids,
    allowed_ips: service.allowed_ips,
    blocked_paths: service.blocked_paths,
    rate_limit_average: service.rate_limit_average,
    rate_limit_burst: service.rate_limit_burst,
    custom_headers: service.custom_headers,
    frame_policy: service.frame_policy,
    healthcheck_enabled: service.healthcheck_enabled,
    healthcheck_path: service.healthcheck_path,
    healthcheck_timeout_ms: service.healthcheck_timeout_ms,
    healthcheck_expected_statuses: service.healthcheck_expected_statuses,
    authentik_group_id: service.authentik_group_id,
    basic_auth_usernames: service.basic_auth_usernames,
  };
}

export function getServiceEditErrorMessage(error: unknown) {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
    "수정 중 오류가 발생했습니다"
  );
}

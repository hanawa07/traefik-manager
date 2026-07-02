import type { UpstreamSecuritySettingsInput } from "@/features/settings/api/settingsApi";

export type UpstreamSecurityForm = UpstreamSecuritySettingsInput & {
  allowed_domain_suffixes_text: string;
};

export function createDefaultUpstreamSecurityForm(): UpstreamSecurityForm {
  return {
    dns_strict_mode: false,
    allowlist_enabled: false,
    allowed_domain_suffixes: [],
    allowed_domain_suffixes_text: "",
    allow_docker_service_names: true,
    allow_private_networks: true,
  };
}

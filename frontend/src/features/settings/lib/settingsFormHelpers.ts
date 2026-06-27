import type {
  SecurityAlertRouteTarget,
  UpstreamSecurityPreset,
  UpstreamSecuritySettingsInput,
} from "@/features/settings/api/settingsApi";
import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";

export function parseMultivalueText(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSecurityAlertRouteLabel(
  route: SecurityAlertRouteTarget,
  defaultProviderLabel: string,
): string {
  switch (route) {
    case "default":
      return `기본 채널 (${defaultProviderLabel})`;
    case "disabled":
      return "전송 안 함";
    case "telegram":
      return "Telegram";
    case "pagerduty":
      return "PagerDuty";
    case "email":
      return "Email";
    default:
      return route;
  }
}

export function getTurnstileModeLabel(mode: "off" | "always" | "risk_based"): string {
  switch (mode) {
    case "always":
      return "항상 적용";
    case "risk_based":
      return "위험 기반 적용";
    default:
      return "비활성화";
  }
}

export function inferUpstreamPresetKey(
  presets: UpstreamSecurityPreset[],
  form: UpstreamSecuritySettingsInput,
): string {
  const matched = presets.find(
    (preset) =>
      preset.dns_strict_mode === form.dns_strict_mode &&
      preset.allowlist_enabled === form.allowlist_enabled &&
      preset.allow_docker_service_names === form.allow_docker_service_names &&
      preset.allow_private_networks === form.allow_private_networks,
  );
  return matched?.key ?? "custom";
}

export function applyUpstreamPreset(
  current: UpstreamSecurityForm,
  preset: UpstreamSecurityPreset,
): UpstreamSecurityForm {
  return {
    ...current,
    dns_strict_mode: preset.dns_strict_mode,
    allowlist_enabled: preset.allowlist_enabled,
    allow_docker_service_names: preset.allow_docker_service_names,
    allow_private_networks: preset.allow_private_networks,
  };
}

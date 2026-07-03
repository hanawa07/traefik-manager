import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  CloudflareZoneInput,
  SettingsActionTestResult,
} from "@/features/settings/api/settingsApi";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";
import { buildActionFailure, getApiErrorDetail } from "@/features/settings/lib/settingsErrors";

export function buildCloudflareZoneFormValue(
  status: CloudflareSettingsStatus | undefined,
): CloudflareZoneInput[] {
  return status?.zones?.length
    ? status.zones.map((zone) => ({
        api_token: "",
        zone_id: zone.zone_id,
        record_target: zone.record_target ?? "",
        proxied: zone.proxied,
      }))
    : [createDefaultCloudflareZoneForm()];
}

export function buildCloudflareActionFailureResult(
  error: unknown,
  message: string,
): SettingsActionTestResult {
  return buildActionFailure(message, getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다"));
}

export function buildCloudflareDriftFailureResult(error: unknown): CloudflareDriftCheckResult {
  return {
    success: false,
    message: "Cloudflare DNS 드리프트 진단에 실패했습니다",
    detail: getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다"),
    zone_count: 0,
    total_services: 0,
    eligible_services: 0,
    skipped_services: 0,
    healthy_services: 0,
    zones: [],
    excluded_services: [],
    missing_records: [],
    mismatched_records: [],
    orphan_records: [],
  };
}

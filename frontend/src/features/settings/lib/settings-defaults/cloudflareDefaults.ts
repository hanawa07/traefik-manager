import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";

export function createDefaultCloudflareZoneForm(): CloudflareZoneInput {
  return {
    api_token: "",
    zone_id: "",
    record_target: "",
    proxied: false,
  };
}

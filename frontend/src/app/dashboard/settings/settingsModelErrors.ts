import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";

export function getSettingsModelErrorMessage(error: unknown, fallback: string) {
  return getApiErrorDetail(error, fallback);
}

import type { SettingsActionTestResult } from "@/features/settings/api/settingsApi";

export function buildActionFailure(message: string, detail?: string): SettingsActionTestResult {
  return {
    success: false,
    message,
    detail: detail || null,
    provider: null,
  };
}

export function getApiErrorDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return fallback;
}

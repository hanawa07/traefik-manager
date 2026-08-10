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
  const response = (error as {
    response?: {
      status?: number;
      data?: { detail?: string | Array<{ msg?: string }> };
    };
  })?.response;
  const fallbackSentence = withTerminalPeriod(fallback);
  if (response?.status === 422) {
    return `입력값을 확인해주세요. ${fallbackSentence}`;
  }
  if (typeof response?.status === "number" && response.status >= 500) {
    return `서버 오류가 발생했습니다. ${fallbackSentence} 잠시 후 다시 시도해주세요.`;
  }
  const detail = response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return fallback;
}

function withTerminalPeriod(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

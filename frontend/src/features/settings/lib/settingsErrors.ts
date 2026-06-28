export function getApiErrorDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return fallback;
}

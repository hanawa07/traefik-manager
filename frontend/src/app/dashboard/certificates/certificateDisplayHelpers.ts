import type { Certificate } from "@/features/certificates/api/certificateApi";

export function getRemainingLabel(certificate: Certificate) {
  if (certificate.days_remaining === null) {
    if (certificate.status === "pending") return "발급 전";
    if (certificate.status === "inactive") return "자동 발급 안 함";
    return "-";
  }
  if (certificate.days_remaining < 0) return "만료됨";
  return `${certificate.days_remaining}일`;
}

export function getCertificateErrorDetail(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return fallback;
}

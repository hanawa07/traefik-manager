import type {
  Certificate,
  CertificateAcmeErrorKind,
} from "@/features/certificates/api/certificateApi";

export function getAcmeErrorKindLabel(kind: CertificateAcmeErrorKind | null | undefined) {
  switch (kind) {
    case "dns":
      return "DNS 검증";
    case "rate_limit":
      return "발급 제한";
    case "authorization":
      return "도메인 인증";
    case "challenge":
      return "챌린지";
    case "unknown":
      return "발급 실패";
    default:
      return null;
  }
}

export function getFailureSummary(certificate: Certificate) {
  if (!certificate.last_acme_error_message) {
    return {
      label: "최근 실패 없음",
      tone: "text-gray-500 dark:text-slate-400",
    };
  }

  const kindLabel = getAcmeErrorKindLabel(certificate.last_acme_error_kind);
  return {
    label: `${kindLabel ? `${kindLabel} · ` : ""}${certificate.last_acme_error_message}`,
    tone: "text-rose-700 dark:text-rose-300",
  };
}

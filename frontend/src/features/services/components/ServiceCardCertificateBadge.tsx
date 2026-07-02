import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service } from "../api/serviceApi";

interface ServiceCardCertificateBadgeProps {
  service: Service;
  certificate?: Certificate;
}

export function ServiceCardCertificateBadge({
  service,
  certificate,
}: ServiceCardCertificateBadgeProps) {
  if (!service.tls_enabled) return null;
  if (!certificate) {
    return (
      <span
        className={
          "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 " +
          "px-2 py-0.5 text-xs font-medium text-slate-600"
        }
      >
        인증서 미확인
      </span>
    );
  }

  const baseClass =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
  switch (certificate.status) {
    case "active":
      return <span className={`${baseClass} border-green-200 bg-green-50 text-green-700`}>인증서 정상</span>;
    case "warning":
      return <span className={`${baseClass} border-yellow-200 bg-yellow-50 text-yellow-700`}>인증서 만료 임박</span>;
    case "error":
      return <span className={`${baseClass} border-red-200 bg-red-50 text-red-700`}>인증서 만료</span>;
    case "pending":
      return <span className={`${baseClass} border-blue-200 bg-blue-50 text-blue-700`}>인증서 발급 대기</span>;
    case "inactive":
    default:
      return <span className={`${baseClass} border-slate-200 bg-slate-100 text-slate-600`}>자동 발급 미설정</span>;
  }
}

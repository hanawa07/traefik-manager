import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { getRemainingLabel } from "./certificatePageHelpers";

interface CertificateDetailFactsProps {
  certificate: Certificate;
  timezone?: string;
}

export default function CertificateDetailFacts({
  certificate,
  timezone,
}: CertificateDetailFactsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">만료일</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {certificate.expires_at ? formatDateTime(certificate.expires_at, timezone) : "-"}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">남은 기간</p>
        <p className="mt-1 text-sm font-medium text-gray-900">{getRemainingLabel(certificate)}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">발급 방식</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {certificate.cert_resolvers.length > 0
            ? `자동 발급 (${certificate.cert_resolvers.join(", ")})`
            : "수동/미설정"}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">라우터</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {certificate.router_names.length > 0 ? certificate.router_names.join(", ") : "-"}
        </p>
      </div>
    </section>
  );
}

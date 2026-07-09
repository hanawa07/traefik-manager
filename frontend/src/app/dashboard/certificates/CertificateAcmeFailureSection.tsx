import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { getFailureSummary } from "./certificatePageHelpers";

interface CertificateAcmeFailureSectionProps {
  certificate: Certificate;
  timezone?: string;
}

export default function CertificateAcmeFailureSection({
  certificate,
  timezone,
}: CertificateAcmeFailureSectionProps) {
  const failureSummary = getFailureSummary(certificate);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">최근 ACME 실패</h3>
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
        <p className={`text-sm font-medium ${failureSummary.tone}`}>{failureSummary.label}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {certificate.last_acme_error_at
            ? formatDateTime(certificate.last_acme_error_at, timezone)
            : "최근 실패 기록이 없습니다"}
        </p>
        {certificate.preflight_repeated_failure_active ? (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
            최근 사전 진단에서 같은 실패가 {certificate.preflight_failure_streak}회 연속 반복됐습니다.
          </p>
        ) : null}
      </div>
    </section>
  );
}

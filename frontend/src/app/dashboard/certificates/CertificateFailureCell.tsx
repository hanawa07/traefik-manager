import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { getFailureSummary } from "./certificatePageHelpers";

interface CertificateFailureCellProps {
  certificate: Certificate;
  timezone?: string;
}

export function CertificateFailureCell({ certificate, timezone }: CertificateFailureCellProps) {
  const failureSummary = getFailureSummary(certificate);

  return (
    <div className="max-w-[280px]">
      <p className={`line-clamp-2 text-sm ${failureSummary.tone}`}>
        {failureSummary.label}
      </p>
      {certificate.last_acme_error_at ? (
        <p className="mt-1 text-[11px] text-gray-400">
          {formatDateTime(certificate.last_acme_error_at, timezone)}
        </p>
      ) : null}
      {certificate.preflight_repeated_failure_active ? (
        <p className="mt-1 text-[11px] text-rose-600">
          같은 실패가 {certificate.preflight_failure_streak}회 연속 반복되었습니다
        </p>
      ) : null}
    </div>
  );
}

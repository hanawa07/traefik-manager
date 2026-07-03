import { AlertTriangle, History } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";

const STATUS_BADGE_BASE_CLASS =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

interface CertificateStatusCellProps {
  certificate: Certificate;
}

export function CertificateStatusCell({ certificate }: CertificateStatusCellProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <StatusBadge status={certificate.status} />
        {certificate.alerts_suppressed ? (
          <span className={`${STATUS_BADGE_BASE_CLASS} bg-amber-50 text-amber-700`}>
            <History className="h-3 w-3" />
            억제 중
          </span>
        ) : null}
        {certificate.preflight_repeated_failure_active ? (
          <span className={`${STATUS_BADGE_BASE_CLASS} bg-rose-50 text-rose-700`}>
            <AlertTriangle className="h-3 w-3" />
            반복 실패 x{certificate.preflight_failure_streak}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-gray-500">{certificate.status_message}</p>
    </div>
  );
}

import { AlertTriangle, ChevronRight, History } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { getFailureSummary, getRemainingLabel } from "./certificatePageHelpers";

const DETAIL_BUTTON_CLASS = [
  "inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2",
  "text-xs font-medium text-gray-700 transition-colors",
  "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
].join(" ");
const STATUS_BADGE_BASE_CLASS =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

interface CertificateListRowProps {
  certificate: Certificate;
  timezone?: string;
  onOpenCertificate: (domain: string) => void;
}

export default function CertificateListRow({
  certificate,
  timezone,
  onOpenCertificate,
}: CertificateListRowProps) {
  const failureSummary = getFailureSummary(certificate);

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-gray-50"
      onClick={() => onOpenCertificate(certificate.domain)}
    >
      <td className="px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{certificate.domain}</p>
          <p className="mt-1 text-xs text-gray-500">
            라우터 {certificate.router_names.length}개
          </p>
        </div>
      </td>
      <td className="px-6 py-4">
        <CertificateStatusCell certificate={certificate} />
      </td>
      <td className="px-6 py-3 text-sm text-gray-500">
        {certificate.expires_at ? formatDateTime(certificate.expires_at, timezone) : "-"}
      </td>
      <td className="px-6 py-3 text-sm text-gray-500">{getRemainingLabel(certificate)}</td>
      <td className="px-6 py-3 text-sm text-gray-500">{getResolverLabel(certificate)}</td>
      <td className="px-6 py-3">
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
      </td>
      <td className="px-6 py-3 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCertificate(certificate.domain);
          }}
          className={DETAIL_BUTTON_CLASS}
        >
          상세 보기
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function CertificateStatusCell({ certificate }: { certificate: Certificate }) {
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

function getResolverLabel(certificate: Certificate) {
  if (certificate.cert_resolvers.length === 0) return "수동/미설정";
  return `자동 발급 (${certificate.cert_resolvers.join(", ")})`;
}

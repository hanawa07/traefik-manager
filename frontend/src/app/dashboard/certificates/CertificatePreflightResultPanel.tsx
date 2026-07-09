import type { CertificatePreflightResult } from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import CertificatePreflightComparison from "./CertificatePreflightComparison";
import CertificatePreflightItemList from "./CertificatePreflightItemList";

interface CertificatePreflightResultPanelProps {
  preflight: CertificatePreflightResult;
  timezone?: string;
}

export default function CertificatePreflightResultPanel({
  preflight,
  timezone,
}: CertificatePreflightResultPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/50 dark:bg-blue-950/30">
        <div className="flex items-center gap-2">
          <StatusBadge status={getPreflightBadgeStatus(preflight.overall_status)} />
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">다음 조치</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-200">{preflight.recommendation}</p>
        <p className="mt-2 text-[11px] text-blue-700 dark:text-blue-300">
          검사 시각 {formatDateTime(preflight.checked_at, timezone)}
        </p>
        {preflight.repeated_failure_active ? (
          <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
            같은 실패가 {preflight.repeated_failure_streak}회 연속 반복돼 알림 대상으로 기록됐습니다.
          </p>
        ) : null}
      </div>

      {preflight.previous_result ? (
        <CertificatePreflightComparison
          current={preflight}
          previous={preflight.previous_result}
          timezone={timezone}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          저장된 이전 사전 진단 결과가 없습니다. 이번 검사부터 이력이 쌓입니다.
        </div>
      )}

      <CertificatePreflightItemList items={preflight.items} />
    </div>
  );
}

function getPreflightBadgeStatus(status: CertificatePreflightResult["overall_status"]) {
  if (status === "ok") return "active";
  if (status === "warning") return "warning";
  return "error";
}

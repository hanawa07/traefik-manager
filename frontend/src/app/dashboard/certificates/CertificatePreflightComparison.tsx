import type { CertificatePreflightSnapshot } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { getChangedPreflightItems, getPreflightTrend } from "./certificatePageHelpers";

interface CertificatePreflightComparisonProps {
  current: CertificatePreflightSnapshot;
  previous: CertificatePreflightSnapshot;
  timezone?: string;
}

export default function CertificatePreflightComparison({
  current,
  previous,
  timezone,
}: CertificatePreflightComparisonProps) {
  const trend = getPreflightTrend(current, previous);
  const changedItems = getChangedPreflightItems(current, previous);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">직전 검사 대비</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            이전 검사 {formatDateTime(previous.checked_at, timezone)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${trend.colorClass}`}
        >
          {trend.label}
        </span>
      </div>
      {changedItems.length > 0 ? (
        <div className="space-y-2">
          {changedItems.map((item) => (
            <div key={item.key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.label}</p>
                <span className="text-[11px] text-gray-500 dark:text-slate-400">{item.summary}</span>
              </div>
              {item.previousDetail ? (
                <p className="mt-2 text-[11px] leading-5 text-gray-500 dark:text-slate-400">
                  이전: {item.previousDetail}
                </p>
              ) : null}
              {"currentDetail" in item ? (
                <p className="mt-1 text-[11px] leading-5 text-gray-700 dark:text-slate-200">
                  현재: {item.currentDetail}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          직전 검사와 비교해 상태 변화가 없습니다.
        </div>
      )}
    </div>
  );
}

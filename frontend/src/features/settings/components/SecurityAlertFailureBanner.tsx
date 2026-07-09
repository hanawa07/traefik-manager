import { AlertTriangle } from "lucide-react";

import type { SettingsTestHistoryItem } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SecurityAlertFailureBannerProps {
  history?: SettingsTestHistoryItem | null;
  isRetrying: boolean;
  label: string;
  onRetry: () => void;
  timezone?: string;
}

export function SecurityAlertFailureBanner({
  history,
  isRetrying,
  label,
  onRetry,
  timezone,
}: SecurityAlertFailureBannerProps) {
  if (!history?.last_failure_at) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-200" />
            <p className="font-semibold">{label} 최근 전송 실패</p>
          </div>
          <p className="mt-1">
            {formatDateTime(history.last_failure_at, timezone)}
            {history.last_failure_provider ? ` · ${history.last_failure_provider}` : ""}
          </p>
          <p className="mt-1 break-words text-amber-800 dark:text-amber-200">
            {history.last_failure_detail || history.last_failure_message || "실패 상세가 기록되지 않았습니다."}
          </p>
        </div>
        {history.last_failure_audit_id ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/40 dark:bg-slate-950 dark:text-amber-100 dark:hover:bg-amber-500/10"
          >
            {isRetrying ? "재시도 중..." : "마지막 실패 재시도"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

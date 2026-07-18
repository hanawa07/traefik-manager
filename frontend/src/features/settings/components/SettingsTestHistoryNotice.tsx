import Link from "next/link";

import type { SettingsTestHistoryItem } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

export default function SettingsTestHistoryNotice({
  label,
  history,
  timezone,
  onRetry,
  isRetrying = false,
}: {
  label: string;
  history: SettingsTestHistoryItem | null | undefined;
  timezone?: string;
  onRetry?: (() => void) | null;
  isRetrying?: boolean;
}) {
  if (!history?.last_event) {
    return <p className="text-xs text-gray-500 dark:text-slate-400">{label}: 아직 기록이 없습니다.</p>;
  }
  const latestAuditId = history.recent_events[0]?.audit_id;
  const canRetry = Boolean(onRetry && history.last_failure_audit_id);

  return (
    <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p>
            {label}:{" "}
            <span className={history.last_success ? "font-medium text-green-700 dark:text-emerald-200" : "font-medium text-red-700 dark:text-red-200"}>
              {history.last_success ? "성공" : "실패"}
            </span>
          </p>
          <p>시각: {history.last_created_at ? formatDateTime(history.last_created_at, timezone) : "-"}</p>
          <p>메시지: {history.last_message || "-"}</p>
        </div>
        {latestAuditId || canRetry ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {latestAuditId ? (
              <Link
                aria-label={`${label} 감사 상세`}
                className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                href={`/dashboard/audit?q=${encodeURIComponent(latestAuditId)}&expand=${encodeURIComponent(latestAuditId)}`}
              >
                감사 상세
              </Link>
            ) : null}
            {canRetry ? (
              <button
                type="button"
                onClick={() => onRetry?.()}
                disabled={isRetrying}
                className={[
                  "w-full rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800 sm:w-auto",
                  "transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60",
                  "dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-500/10",
                ].join(" ")}
              >
                {isRetrying ? "재시도 중..." : "마지막 실패 재시도"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {history.last_provider ? <p>채널: {history.last_provider}</p> : null}
      {history.last_success_at ? <p>최근 성공: {formatDateTime(history.last_success_at, timezone)}</p> : null}
      {history.last_failure_at ? <p>최근 실패: {formatDateTime(history.last_failure_at, timezone)}</p> : null}
      {history.recent_failure_count > 0 ? <p>최근 24시간 실패: {history.recent_failure_count}회</p> : null}
      {history.last_failure_provider ? <p>최근 실패 채널: {history.last_failure_provider}</p> : null}
      {history.last_failure_message ? <p>최근 실패 메시지: {history.last_failure_message}</p> : null}
      {history.last_failure_detail ? <p className="text-gray-500 dark:text-slate-400">실패 상세: {history.last_failure_detail}</p> : null}
      {history.last_detail ? <p className="text-gray-500 dark:text-slate-400">{history.last_detail}</p> : null}
    </div>
  );
}

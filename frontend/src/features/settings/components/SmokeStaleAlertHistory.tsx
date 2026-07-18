import type { SettingsTestHistoryItem } from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SmokeStaleAlertHistoryProps {
  history?: SettingsTestHistoryItem;
  timezone?: string;
}

export function SmokeStaleAlertHistory({ history, timezone }: SmokeStaleAlertHistoryProps) {
  const recentEvents = history?.recent_events ?? [];
  return (
    <>
      <SettingsSummaryRow
        label="최근 dry-run 결과"
        value={
          history?.last_created_at ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge success={history.last_success} />
              <span>
                {history.last_provider || "telegram"} · {formatDateTime(history.last_created_at, timezone)}
              </span>
            </span>
          ) : (
            "기록 없음"
          )
        }
      />
      <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
          dry-run 최근 이력 {recentEvents.length}건 (최대 5건)
        </summary>
        {recentEvents.length ? (
          <ol className="mt-3 space-y-2">
            {recentEvents.map((event) => (
              <li
                key={event.audit_id}
                className="rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge success={event.success} />
                  <span>{event.provider || "telegram"}</span>
                  <span className="text-gray-500 dark:text-slate-400">
                    {formatDateTime(event.created_at, timezone)}
                  </span>
                </div>
                {event.message ? <p className="mt-2 text-gray-700 dark:text-slate-200">{event.message}</p> : null}
                {event.detail ? <p className="mt-1 break-all text-gray-500 dark:text-slate-400">{event.detail}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">표시할 dry-run 이력이 없습니다.</p>
        )}
      </details>
    </>
  );
}

function StatusBadge({ success }: { success: boolean | null }) {
  const style = success === null
    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    : success
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {success === null ? "결과 없음" : success ? "성공" : "실패"}
    </span>
  );
}

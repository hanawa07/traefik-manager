import { History } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerDeploymentHistoryProps {
  entries?: ManagerDeploymentHistoryEntry[];
  timezone?: string;
}

const STATUS_DISPLAY = {
  success: {
    label: "전환 완료",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  failed_before_switch: {
    label: "전환 전 중단",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rolled_back: {
    label: "자동 롤백",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rollback_failed: {
    label: "롤백 실패",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  },
} as const;

export function ManagerDeploymentHistory({
  entries = [],
  timezone,
}: ManagerDeploymentHistoryProps) {
  return (
    <section
      className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/60"
      data-manager-deployment-history
    >
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">배포 전환 이력</h3>
        <span className="text-xs text-gray-500 dark:text-slate-400">최근 {entries.length}건</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          기록된 blue-green 배포가 없습니다.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2 lg:grid-cols-2">
          {entries.map((entry) => {
            const status = STATUS_DISPLAY[entry.status];
            return (
              <li
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
                data-deployment-status={entry.status}
                key={`${entry.completed_at}-${entry.to_slot}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                      {entry.from_slot} → {entry.to_slot}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    활성 {entry.active_slot}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                  {entry.version} · <span className="font-mono">{entry.revision.slice(0, 12)}</span>
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                  {formatProbe(entry)} · {formatDateTime(entry.completed_at, timezone)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatProbe(entry: ManagerDeploymentHistoryEntry): string {
  if (entry.probe_total === 0) return "공개 probe 전 종료";
  if (entry.probe_failures > 0) {
    return `probe ${entry.probe_total}건 중 ${entry.probe_failures}건 실패`;
  }
  return `probe ${entry.probe_total}건 모두 HTTP 200`;
}

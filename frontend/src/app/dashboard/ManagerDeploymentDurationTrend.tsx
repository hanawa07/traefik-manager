import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
  getManagerDeploymentSpeedThresholdMs,
  type ManagerDeploymentDurationStats,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistorySpeedFilter } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentDurationTrend({
  entries,
  speed,
  stats,
  timezone,
}: {
  entries: ManagerDeploymentHistoryEntry[];
  speed: ManagerDeploymentHistorySpeedFilter;
  stats: ManagerDeploymentDurationStats;
  timezone?: string;
}) {
  const points = entries.flatMap((entry) => {
    const durationMs = getManagerDeploymentDurationMs(entry.started_at, entry.completed_at);
    return durationMs === null ? [] : [{ durationMs, entry }];
  }).sort((left, right) => Date.parse(left.entry.completed_at) - Date.parse(right.entry.completed_at));
  if (points.length === 0) return null;

  const thresholdMs = getManagerDeploymentSpeedThresholdMs(stats, speed);
  const maxDurationMs = Math.max(
    1,
    ...points.map((point) => point.durationMs),
    stats.averageMs ?? 0,
    stats.p95Ms ?? 0,
  );
  const minWidth = Math.max(320, points.length * 38);

  return (
    <div
      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
      data-deployment-duration-trend={points.length}
      data-deployment-speed-basis={speed === "p95" ? "p95" : "average"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <strong className="text-slate-700 dark:text-slate-200">배포시간 추이</strong>
        <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Legend color="bg-blue-500" label={`평균 ${durationLabel(stats.averageMs)}`} />
          <Legend color="bg-amber-500" label={`P95 ${durationLabel(stats.p95Ms)}`} />
        </span>
      </div>
      <div className="mt-2 overflow-x-auto pb-1">
        <div style={{ minWidth }}>
          <div
            aria-label="시간순 배포 소요시간 막대 차트"
            className="relative h-24 border-b border-slate-200 dark:border-slate-700"
          >
            <ReferenceLine color="border-blue-400" durationMs={stats.averageMs} maxDurationMs={maxDurationMs} />
            <ReferenceLine color="border-amber-400" durationMs={stats.p95Ms} maxDurationMs={maxDurationMs} />
            <div
              aria-label="시간순 배포 소요시간"
              className="absolute inset-0 flex items-end gap-2 px-1"
              role="list"
            >
              {points.map(({ durationMs, entry }) => {
                const slow = thresholdMs !== null && durationMs > thresholdMs;
                return (
                  <span
                    aria-label={`${entry.version}, ${formatDateTime(entry.completed_at, timezone)}, ${formatManagerDeploymentDurationMs(durationMs)}`}
                    className={`min-h-1 flex-1 rounded-t ${slow ? "bg-orange-500" : "bg-sky-500"}`}
                    data-deployment-duration-bar={durationMs}
                    data-deployment-version={entry.version}
                    key={`${entry.completed_at}-${entry.to_slot}`}
                    role="listitem"
                    style={{ height: `${Math.max(3, durationMs / maxDurationMs * 100)}%` }}
                    title={`${entry.version} · ${formatManagerDeploymentDurationMs(durationMs)}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex gap-2 px-1 text-center text-[9px] text-slate-500 dark:text-slate-400">
            {points.map(({ entry }) => (
              <span className="min-w-0 flex-1 truncate" key={`${entry.completed_at}-${entry.to_slot}`}>
                {entry.version}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceLine({
  color,
  durationMs,
  maxDurationMs,
}: {
  color: string;
  durationMs: number | null;
  maxDurationMs: number;
}) {
  if (durationMs === null) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-0 z-10 border-t border-dashed ${color}`}
      style={{ bottom: `${durationMs / maxDurationMs * 100}%` }}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function durationLabel(durationMs: number | null): string {
  return durationMs === null ? "확인 불가" : formatManagerDeploymentDurationMs(durationMs);
}

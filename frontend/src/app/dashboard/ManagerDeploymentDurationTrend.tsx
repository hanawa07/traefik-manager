import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
  getManagerDeploymentSpeedThresholdMs,
  type ManagerDeploymentDurationStats,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistorySpeedFilter } from "./managerDeploymentHistoryQuery";
import type { ManagerDeploymentPeriodComparison } from "./managerDeploymentPeriodComparison";

export function ManagerDeploymentDurationTrend({
  comparison,
  entries,
  speed,
  stats,
  timezone,
}: {
  comparison: ManagerDeploymentPeriodComparison | null;
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
    comparison?.averageMs ?? 0,
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
          <Legend color="bg-blue-500" label={`${comparison ? "현재 " : ""}평균 ${durationLabel(stats.averageMs)}`} />
          <Legend color="bg-amber-500" label={`P95 ${durationLabel(stats.p95Ms)}`} />
          {comparison?.averageMs != null ? (
            <Legend color="bg-teal-500" label={`직전 평균 ${durationLabel(comparison.averageMs)}`} />
          ) : null}
        </span>
      </div>
      {comparison ? <ComparisonSummary comparison={comparison} currentAverageMs={stats.averageMs} /> : null}
      <div className="mt-2 overflow-x-auto pb-1">
        <div style={{ minWidth }}>
          <div
            aria-label="시간순 배포 소요시간 막대 차트"
            className="relative h-24 border-b border-slate-200 dark:border-slate-700"
          >
            <ReferenceLine color="border-blue-400" durationMs={stats.averageMs} maxDurationMs={maxDurationMs} />
            <ReferenceLine color="border-amber-400" durationMs={stats.p95Ms} maxDurationMs={maxDurationMs} />
            <ReferenceLine color="border-teal-400" durationMs={comparison?.averageMs ?? null} maxDurationMs={maxDurationMs} />
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

function ComparisonSummary({
  comparison,
  currentAverageMs,
}: {
  comparison: ManagerDeploymentPeriodComparison;
  currentAverageMs: number | null;
}) {
  if (comparison.averageMs === null || currentAverageMs === null) {
    return (
      <p
        className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 dark:bg-slate-950/60 dark:text-slate-400"
        data-deployment-period-comparison="empty"
        data-previous-period-count={comparison.count}
      >
        직전 동일 기간에 비교할 배포가 없습니다.
      </p>
    );
  }

  const deltaMs = currentAverageMs - comparison.averageMs;
  const signedDeltaPercent = comparison.averageMs === 0
    ? null
    : Math.round(deltaMs / comparison.averageMs * 100);
  const deltaLabel = deltaMs === 0
    ? "동일"
    : `${signedDeltaPercent === null ? "" : `${Math.abs(signedDeltaPercent)}% `}${deltaMs < 0 ? "단축" : "증가"}`;
  const tone = deltaMs < 0
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
    : deltaMs > 0
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200"
      : "bg-slate-50 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300";

  return (
    <p
      className={`mt-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${tone}`}
      data-current-period-average-ms={currentAverageMs}
      data-deployment-period-comparison="available"
      data-period-delta-percent={deltaMs === 0 ? 0 : signedDeltaPercent ?? undefined}
      data-previous-period-average-ms={comparison.averageMs}
      data-previous-period-count={comparison.count}
    >
      직전 동일 기간 평균 {formatManagerDeploymentDurationMs(comparison.averageMs)} · 현재 평균{" "}
      {formatManagerDeploymentDurationMs(currentAverageMs)} ({deltaLabel})
    </p>
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

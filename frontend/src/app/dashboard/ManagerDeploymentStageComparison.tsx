import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentStageStats,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistoryFailureStage } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentStageComparison({
  currentEntries,
  previousEntries,
}: {
  currentEntries: ManagerDeploymentHistoryEntry[];
  previousEntries: ManagerDeploymentHistoryEntry[] | null;
}) {
  if (previousEntries === null) return null;

  const current = new Map(getManagerDeploymentStageStats(currentEntries).map((item) => [item.stage, item]));
  const previous = new Map(getManagerDeploymentStageStats(previousEntries).map((item) => [item.stage, item]));
  const stages = (Object.keys(
    MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  ) as ManagerDeploymentHistoryFailureStage[]).filter(
    (stage) => current.has(stage) || previous.has(stage),
  );
  if (stages.length === 0) return null;

  const maxAverageMs = Math.max(
    1,
    ...stages.flatMap((stage) => [
      current.get(stage)?.averageMs ?? 0,
      previous.get(stage)?.averageMs ?? 0,
    ]),
  );

  return (
    <section
      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
      data-deployment-stage-comparison
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-slate-700 dark:text-slate-200">단계별 기간 비교</strong>
        <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Legend color="bg-sky-500" label="현재" />
          <Legend color="bg-teal-500" label="직전 동일 기간" />
        </span>
      </div>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        각 단계의 평균 소요시간을 직전 동일 기간과 비교합니다.
      </p>
      <div className="mt-2 space-y-2">
        {stages.map((stage) => {
          const currentAverage = current.get(stage)?.averageMs ?? null;
          const previousAverage = previous.get(stage)?.averageMs ?? null;
          const deltaPercent = getDeltaPercent(currentAverage, previousAverage);
          return (
            <div
              data-current-stage-average-ms={currentAverage ?? undefined}
              data-previous-stage-average-ms={previousAverage ?? undefined}
              data-stage-average-delta-percent={deltaPercent ?? undefined}
              data-stage-period-comparison={stage}
              key={stage}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[stage]}
                </span>
                <span className={deltaTone(deltaPercent)}>{deltaLabel(deltaPercent)}</span>
              </div>
              <ComparisonBar
                averageMs={currentAverage}
                color="bg-sky-500"
                label="현재"
                maxAverageMs={maxAverageMs}
              />
              <ComparisonBar
                averageMs={previousAverage}
                color="bg-teal-500"
                label="직전"
                maxAverageMs={maxAverageMs}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComparisonBar({
  averageMs,
  color,
  label,
  maxAverageMs,
}: {
  averageMs: number | null;
  color: string;
  label: string;
  maxAverageMs: number;
}) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-7 shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {averageMs === null ? null : (
          <span
            className={`block h-full rounded-full ${color}`}
            style={{ width: `${Math.max(2, averageMs / maxAverageMs * 100)}%` }}
          />
        )}
      </span>
      <span className="w-14 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
        {averageMs === null ? "기록 없음" : formatManagerDeploymentDurationMs(averageMs)}
      </span>
    </div>
  );
}

function getDeltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}

function deltaLabel(deltaPercent: number | null): string {
  if (deltaPercent === null) return "비교 불가";
  if (deltaPercent === 0) return "동일";
  return `${Math.abs(deltaPercent)}% ${deltaPercent < 0 ? "단축" : "증가"}`;
}

function deltaTone(deltaPercent: number | null): string {
  if (deltaPercent === null || deltaPercent === 0) return "text-slate-500 dark:text-slate-400";
  return deltaPercent < 0
    ? "font-semibold text-emerald-700 dark:text-emerald-300"
    : "font-semibold text-red-700 dark:text-red-300";
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}

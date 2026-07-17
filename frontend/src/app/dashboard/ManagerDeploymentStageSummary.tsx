import { AlertTriangle } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentBottleneck,
  getManagerDeploymentStageStats,
  MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentBottleneckThreshold } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentStageSummary({
  entries,
  onThresholdChange,
  threshold,
}: {
  entries: ManagerDeploymentHistoryEntry[];
  onThresholdChange: (threshold: ManagerDeploymentBottleneckThreshold) => void;
  threshold: ManagerDeploymentBottleneckThreshold;
}) {
  const stats = getManagerDeploymentStageStats(entries);
  if (stats.length === 0) return null;

  const thresholdMs = Number(threshold);
  const alertCount = entries.filter((entry) => {
    const bottleneck = getManagerDeploymentBottleneck(entry.stage_durations_ms);
    return bottleneck !== null && bottleneck.durationMs > thresholdMs;
  }).length;

  return (
    <section
      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
      data-deployment-stage-summary
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-slate-700 dark:text-slate-200">단계별 성능</strong>
        <span
          aria-live="polite"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
            alertCount > 0
              ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          }`}
          data-deployment-stage-alert-count={alertCount}
        >
          {alertCount > 0 ? <AlertTriangle aria-hidden="true" className="h-3 w-3" /> : null}
          {alertCount > 0 ? `병목 경고 ${alertCount}건` : "병목 경고 없음"}
        </span>
        <label className="ml-auto inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
          경고 기준
          <select
            aria-label="배포 단계 병목 경고 기준"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-deployment-bottleneck-threshold
            onChange={(event) => onThresholdChange(
              event.target.value as ManagerDeploymentBottleneckThreshold,
            )}
            value={threshold}
          >
            {MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        선택한 소스·기간에서 단계 시간이 기록된 배포만 집계합니다.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              <th className="pb-1.5 font-medium">단계</th>
              <th className="pb-1.5 text-right font-medium">표본</th>
              <th className="pb-1.5 text-right font-medium">평균</th>
              <th className="pb-1.5 text-right font-medium">P95</th>
              <th className="pb-1.5 text-right font-medium">최대</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.map((item) => {
              const warning = item.maxMs > thresholdMs;
              return (
                <tr
                  className={warning ? "text-red-700 dark:text-red-200" : "text-slate-700 dark:text-slate-300"}
                  data-stage-alert={warning ? "true" : "false"}
                  data-stage-average-ms={item.averageMs}
                  data-stage-count={item.count}
                  data-stage-max-ms={item.maxMs}
                  data-stage-p95-ms={item.p95Ms}
                  data-stage-performance={item.stage}
                  key={item.stage}
                >
                  <th className="py-1.5 font-semibold">
                    {warning ? <AlertTriangle aria-hidden="true" className="mr-1 inline h-3 w-3" /> : null}
                    {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[item.stage]}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{item.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatManagerDeploymentDurationMs(item.averageMs)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatManagerDeploymentDurationMs(item.p95Ms)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatManagerDeploymentDurationMs(item.maxMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

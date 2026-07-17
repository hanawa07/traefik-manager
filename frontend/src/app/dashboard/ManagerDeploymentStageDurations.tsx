import type {
  ManagerDeploymentStage,
} from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
} from "./managerDeploymentHistoryDisplay";

const STAGES = Object.keys(
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
) as ManagerDeploymentStage[];

export function ManagerDeploymentStageDurations({
  durations,
}: {
  durations: Partial<Record<ManagerDeploymentStage, number>>;
}) {
  const recorded = STAGES.flatMap((stage) => {
    const durationMs = durations[stage];
    return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? [{ durationMs, stage }]
      : [];
  });
  if (recorded.length === 0) return null;

  const bottleneck = recorded.reduce((slowest, item) =>
    item.durationMs > slowest.durationMs ? item : slowest);
  const maxDurationMs = Math.max(bottleneck.durationMs, 1);

  return (
    <details
      className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950/60"
      data-deployment-bottleneck={bottleneck.stage}
      data-deployment-stage-durations
    >
      <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
        단계 병목 · {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[bottleneck.stage]}{" "}
        {formatManagerDeploymentDurationMs(bottleneck.durationMs)}
      </summary>
      <div className="mt-2 grid gap-1.5">
        {recorded.map(({ durationMs, stage }) => (
          <div
            className="grid grid-cols-[8rem_1fr_auto] items-center gap-2"
            data-deployment-stage-duration={stage}
            data-duration-ms={durationMs}
            key={stage}
          >
            <span className="truncate text-slate-600 dark:text-slate-300">
              {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[stage]}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span
                className={`block h-full rounded-full ${
                  stage === bottleneck.stage ? "bg-orange-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.max(2, durationMs / maxDurationMs * 100)}%` }}
              />
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {formatManagerDeploymentDurationMs(durationMs)}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

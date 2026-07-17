import { AlertTriangle } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentBottleneckAlerts,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentBottleneckThreshold } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentBottleneckAlert({
  entries,
  threshold,
}: {
  entries: ManagerDeploymentHistoryEntry[];
  threshold: ManagerDeploymentBottleneckThreshold;
}) {
  const thresholdMs = Number(threshold);
  const alerts = getManagerDeploymentBottleneckAlerts(entries, thresholdMs);
  if (alerts.length === 0) return null;

  const worst = alerts[0];
  return (
    <div
      aria-live="polite"
      className="mt-3 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 sm:flex-row sm:items-center dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
      data-deployment-bottleneck-banner={alerts.length}
      role="alert"
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <strong>배포 단계 병목 {alerts.length}건</strong>
        <p className="mt-0.5 text-[11px] leading-relaxed">
          가장 느린 항목: {worst.entry.version} · {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[worst.stage]}{" "}
          {formatManagerDeploymentDurationMs(worst.durationMs)} · 기준 {formatManagerDeploymentDurationMs(thresholdMs)}
        </p>
      </div>
      <a
        className="w-fit shrink-0 font-semibold underline underline-offset-2"
        href="#manager-deployment-stage-performance"
      >
        단계 성능 보기
      </a>
    </div>
  );
}

import type {
  ManagerDeploymentHistoryEntry,
  ManagerDeploymentStage,
} from "../api/deploymentApi";

export interface DeploymentBottleneckPreview {
  currentCount: number;
  hasHistory: boolean;
  latestVersion: string | null;
  remainingCount: number;
  slowestMs: number;
  slowestStage: ManagerDeploymentStage | null;
  wouldAlert: boolean;
}

export function buildDeploymentBottleneckPreview(
  entries: ManagerDeploymentHistoryEntry[],
  thresholdMs: number,
  requiredCount: number,
): DeploymentBottleneckPreview {
  let currentCount = 0;
  let slowestMs = 0;
  let slowestStage: ManagerDeploymentStage | null = null;

  for (const entry of entries) {
    if (entry.status !== "success") break;
    const slowest = Object.entries(entry.stage_durations_ms).reduce<{
      durationMs: number;
      stage: ManagerDeploymentStage;
    } | null>((current, [stage, durationMs]) => {
      if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
        return current;
      }
      return !current || durationMs > current.durationMs
        ? { durationMs, stage: stage as ManagerDeploymentStage }
        : current;
    }, null);
    if (!slowest || slowest.durationMs <= thresholdMs) break;

    currentCount += 1;
    if (slowest.durationMs > slowestMs) {
      slowestMs = slowest.durationMs;
      slowestStage = slowest.stage;
    }
  }

  return {
    currentCount,
    hasHistory: entries.length > 0,
    latestVersion: currentCount > 0 ? entries[0].version : null,
    remainingCount: Math.max(0, requiredCount - currentCount),
    slowestMs,
    slowestStage,
    wouldAlert: currentCount >= requiredCount,
  };
}

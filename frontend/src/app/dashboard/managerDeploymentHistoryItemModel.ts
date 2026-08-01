import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
  getManagerDeploymentExcessDurationMs,
  MANAGER_DEPLOYMENT_STATUS_DISPLAY,
} from "./managerDeploymentHistoryDisplay";
import {
  buildManagerDeploymentLinks,
  getManagerDeploymentHistoryAnchor,
} from "./managerDeploymentLinks";

interface ManagerDeploymentHistoryItemModelInput {
  entry: ManagerDeploymentHistoryEntry;
  previousVersion?: string;
  source?: string | null;
  thresholdDurationMs: number | null;
}

export function buildManagerDeploymentHistoryItemModel({
  entry,
  previousVersion,
  source,
  thresholdDurationMs,
}: ManagerDeploymentHistoryItemModelInput) {
  const durationMs = getManagerDeploymentDurationMs(entry.started_at, entry.completed_at);
  const excessDurationMs = getManagerDeploymentExcessDurationMs(durationMs, thresholdDurationMs);

  return {
    anchor: getManagerDeploymentHistoryAnchor(entry.revision, entry.completed_at),
    duration: durationMs === null ? "확인 불가" : formatManagerDeploymentDurationMs(durationMs),
    excessDuration: excessDurationMs === null
      ? null
      : formatManagerDeploymentDurationMs(excessDurationMs),
    excessDurationMs,
    isSlowerThanThreshold: excessDurationMs !== null,
    links: buildManagerDeploymentLinks({
      latestVersion: entry.version,
      previousVersion,
      revision: entry.revision,
      source,
    }),
    probe: formatManagerDeploymentProbe(entry),
    revision: entry.revision.slice(0, 12),
    status: MANAGER_DEPLOYMENT_STATUS_DISPLAY[entry.status],
  };
}

export function formatManagerDeploymentProbe(entry: ManagerDeploymentHistoryEntry): string {
  if (entry.probe_total === 0) return "공개 probe 전 종료";
  if (entry.probe_failures > 0) {
    return `probe ${entry.probe_total}건 중 ${entry.probe_failures}건 실패`;
  }
  return `probe ${entry.probe_total}건 모두 HTTP 200`;
}

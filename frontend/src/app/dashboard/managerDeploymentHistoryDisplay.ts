import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import {
  MANAGER_DEPLOYMENT_STAGE_LABELS,
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
} from "@/features/deployment/lib/managerDeploymentDisplay";

import type {
  ManagerDeploymentBottleneckThreshold,
  ManagerDeploymentHistoryFailureStage,
  ManagerDeploymentHistoryPeriodFilter,
  ManagerDeploymentHistorySpeedFilter,
  ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";

export const MANAGER_DEPLOYMENT_STATUS_DISPLAY = {
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
} as const satisfies Record<
  ManagerDeploymentHistoryEntry["status"],
  { className: string; label: string }
>;

export const MANAGER_DEPLOYMENT_FILTER_OPTIONS: readonly {
  value: ManagerDeploymentHistoryStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "success", label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.success.label },
  { value: "failure", label: "실패 전체" },
  {
    value: "failed_before_switch",
    label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.failed_before_switch.label,
  },
  { value: "rollback", label: "롤백 전체" },
  { value: "rolled_back", label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.rolled_back.label },
  {
    value: "rollback_failed",
    label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.rollback_failed.label,
  },
];

export const MANAGER_DEPLOYMENT_PERIOD_OPTIONS: readonly {
  label: string;
  value: ManagerDeploymentHistoryPeriodFilter;
}[] = [
  { value: "all", label: "전체 기간" },
  { value: "1", label: "최근 24시간" },
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
  { value: "90", label: "최근 90일" },
];

export const MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS: Record<
  ManagerDeploymentHistoryFailureStage,
  string
> = MANAGER_DEPLOYMENT_STAGE_LABELS;
export { formatManagerDeploymentDurationMs, getManagerDeploymentDurationMs };

export const MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS: readonly {
  label: string;
  value: ManagerDeploymentBottleneckThreshold;
}[] = [
  { label: "15초", value: "15000" },
  { label: "30초", value: "30000" },
  { label: "1분", value: "60000" },
  { label: "2분", value: "120000" },
  { label: "5분", value: "300000" },
];

export interface ManagerDeploymentDurationStats {
  averageMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
}

export interface ManagerDeploymentStageStats {
  averageMs: number;
  count: number;
  maxMs: number;
  p95Ms: number;
  stage: ManagerDeploymentHistoryFailureStage;
}

export interface ManagerDeploymentBottleneck {
  durationMs: number;
  stage: ManagerDeploymentHistoryFailureStage;
}

export interface ManagerDeploymentBottleneckAlert extends ManagerDeploymentBottleneck {
  entry: ManagerDeploymentHistoryEntry;
}

export function getManagerDeploymentDurationStats(
  entries: ManagerDeploymentHistoryEntry[],
): ManagerDeploymentDurationStats {
  const durations = entries
    .map((entry) => getManagerDeploymentDurationMs(entry.started_at, entry.completed_at))
    .filter((duration): duration is number => duration !== null)
    .sort((left, right) => left - right);
  if (durations.length === 0) {
    return { averageMs: null, medianMs: null, p95Ms: null };
  }

  const middle = Math.floor(durations.length / 2);
  const medianMs = durations.length % 2 === 0
    ? Math.round((durations[middle - 1] + durations[middle]) / 2)
    : durations[middle];

  return {
    averageMs: Math.round(
      durations.reduce((total, duration) => total + duration, 0) / durations.length,
    ),
    medianMs,
    p95Ms: percentile(durations, 0.95),
  };
}

export function getManagerDeploymentStageStats(
  entries: ManagerDeploymentHistoryEntry[],
): ManagerDeploymentStageStats[] {
  return (Object.keys(
    MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  ) as ManagerDeploymentHistoryFailureStage[]).flatMap((stage) => {
    const durations = entries
      .map((entry) => entry.stage_durations_ms[stage])
      .filter(isValidStageDuration)
      .sort((left, right) => left - right);
    if (durations.length === 0) return [];
    return [{
      averageMs: Math.round(
        durations.reduce((total, duration) => total + duration, 0) / durations.length,
      ),
      count: durations.length,
      maxMs: durations[durations.length - 1],
      p95Ms: percentile(durations, 0.95),
      stage,
    }];
  });
}

export function getManagerDeploymentBottleneck(
  durations: ManagerDeploymentHistoryEntry["stage_durations_ms"],
): ManagerDeploymentBottleneck | null {
  return (Object.keys(
    MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  ) as ManagerDeploymentHistoryFailureStage[]).reduce<ManagerDeploymentBottleneck | null>(
    (slowest, stage) => {
      const durationMs = durations[stage];
      if (!isValidStageDuration(durationMs)) return slowest;
      return !slowest || durationMs > slowest.durationMs ? { durationMs, stage } : slowest;
    },
    null,
  );
}

export function getManagerDeploymentBottleneckAlerts(
  entries: ManagerDeploymentHistoryEntry[],
  thresholdMs: number,
): ManagerDeploymentBottleneckAlert[] {
  return entries.flatMap((entry) => {
    const bottleneck = getManagerDeploymentBottleneck(entry.stage_durations_ms);
    return bottleneck && bottleneck.durationMs > thresholdMs
      ? [{ ...bottleneck, entry }]
      : [];
  }).sort((left, right) => right.durationMs - left.durationMs);
}

export function getManagerDeploymentSpeedThresholdMs(
  stats: ManagerDeploymentDurationStats,
  speed: ManagerDeploymentHistorySpeedFilter,
): number | null {
  return speed === "p95" ? stats.p95Ms : stats.averageMs;
}

export function getManagerDeploymentExcessDurationMs(
  durationMs: number | null,
  thresholdDurationMs: number | null,
): number | null {
  if (durationMs === null || thresholdDurationMs === null || durationMs <= thresholdDurationMs) {
    return null;
  }
  return durationMs - thresholdDurationMs;
}

function percentile(sortedDurations: number[], ratio: number): number {
  const position = (sortedDurations.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedDurations[lowerIndex];
  const upper = sortedDurations[upperIndex];
  return Math.round(lower + (upper - lower) * (position - lowerIndex));
}

function isValidStageDuration(duration: number | undefined): duration is number {
  return typeof duration === "number" && Number.isFinite(duration) && duration >= 0;
}

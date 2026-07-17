import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  getManagerDeploymentDurationMs,
  getManagerDeploymentDurationStats,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistoryFilters } from "./managerDeploymentHistoryQuery";

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface ManagerDeploymentPeriodComparison {
  averageMs: number | null;
  count: number;
  entries: ManagerDeploymentHistoryEntry[];
}

export function getManagerDeploymentPeriodComparison(
  entries: ManagerDeploymentHistoryEntry[],
  filters: ManagerDeploymentHistoryFilters,
  referenceTime: number,
): ManagerDeploymentPeriodComparison | null {
  const currentRange = getCurrentRange(filters, referenceTime);
  if (!currentRange) return null;

  const [currentStart, currentEnd] = currentRange;
  const duration = currentEnd - currentStart;
  if (duration <= 0) return null;
  const previousStart = currentStart - duration;
  const previousEntries = entries.filter((entry) => {
    const completedAt = Date.parse(entry.completed_at);
    return completedAt >= previousStart && completedAt < currentStart;
  });
  const validCount = previousEntries.filter((entry) =>
    getManagerDeploymentDurationMs(entry.started_at, entry.completed_at) !== null).length;
  return {
    averageMs: getManagerDeploymentDurationStats(previousEntries).averageMs,
    count: validCount,
    entries: previousEntries,
  };
}

export function getManagerDeploymentDateBoundary(
  value: string,
  nextDay = false,
): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const boundary = new Date(year, month - 1, day);
  if (nextDay) boundary.setDate(boundary.getDate() + 1);
  return boundary.getTime();
}

function getCurrentRange(
  filters: ManagerDeploymentHistoryFilters,
  referenceTime: number,
): [number, number] | null {
  if (filters.dateFrom || filters.dateTo) {
    if (!filters.dateFrom || !filters.dateTo) return null;
    const start = getManagerDeploymentDateBoundary(filters.dateFrom);
    const end = getManagerDeploymentDateBoundary(filters.dateTo, true);
    return start === null || end === null ? null : [start, end];
  }
  if (filters.period === "all") return null;
  const duration = Number(filters.period) * DAY_MS;
  return [referenceTime - duration, referenceTime];
}

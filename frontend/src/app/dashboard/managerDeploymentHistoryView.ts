import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  getManagerDeploymentDurationMs,
  getManagerDeploymentDurationStats,
  getManagerDeploymentExcessDurationMs,
  getManagerDeploymentSpeedThresholdMs,
} from "./managerDeploymentHistoryDisplay";
import {
  matchesManagerDeploymentHistoryStatus,
  type ManagerDeploymentHistoryFilters,
  type ManagerDeploymentHistoryRecordSource,
} from "./managerDeploymentHistoryQuery";
import {
  getManagerDeploymentDateBoundary,
  getManagerDeploymentPeriodComparison,
} from "./managerDeploymentPeriodComparison";

interface ManagerDeploymentHistoryViewInput {
  archiveEntries: ManagerDeploymentHistoryEntry[];
  entries: ManagerDeploymentHistoryEntry[];
  filters: ManagerDeploymentHistoryFilters;
  periodReferenceTime: number;
}

export function getManagerDeploymentHistoryView({
  archiveEntries,
  entries,
  filters,
  periodReferenceTime,
}: ManagerDeploymentHistoryViewInput) {
  const {
    archiveSample,
    dateFrom,
    dateTo,
    period,
    search,
    source,
    speed,
    stage,
    status,
  } = filters;
  const periodCutoff = period === "all"
    ? null
    : periodReferenceTime - Number(period) * 24 * 60 * 60 * 1_000;
  const dateFromCutoff = getManagerDeploymentDateBoundary(dateFrom);
  const dateToCutoff = getManagerDeploymentDateBoundary(dateTo, true);
  const sourceEntries = source === "archive"
    ? archiveEntries
    : source === "all" ? [...entries, ...archiveEntries] : entries;
  const visibleEntries = archiveSample === "all"
    ? sourceEntries
    : sourceEntries.filter(
        (entry) => entry.archive_sample === null || entry.archive_sample === archiveSample,
      );
  const resolveEntrySource = (
    entry: ManagerDeploymentHistoryEntry,
  ): ManagerDeploymentHistoryRecordSource => entries.includes(entry) ? "current" : "archive";
  const summaryEntries = visibleEntries.filter((entry) => {
    const completedAt = Date.parse(entry.completed_at);
    const matchesPeriod = periodCutoff === null || completedAt >= periodCutoff;
    const matchesDateRange = (dateFromCutoff === null || completedAt >= dateFromCutoff)
      && (dateToCutoff === null || completedAt < dateToCutoff);
    return matchesPeriod && matchesDateRange;
  });
  const summaryCurrentCount = summaryEntries.filter(
    (entry) => resolveEntrySource(entry) === "current",
  ).length;
  const durationStats = getManagerDeploymentDurationStats(summaryEntries);
  const periodComparison = getManagerDeploymentPeriodComparison(
    visibleEntries,
    filters,
    periodReferenceTime,
  );
  const speedThresholdMs = getManagerDeploymentSpeedThresholdMs(durationStats, speed);
  const normalizedSearchText = search.trim().toLowerCase();
  const filteredEntries = summaryEntries.filter((entry) => {
    const matchesStatus = matchesManagerDeploymentHistoryStatus(entry, status);
    const matchesFailureStage = stage === "all"
      || (stage === "unknown"
        ? entry.status !== "success" && !entry.failure_stage
        : entry.failure_stage === stage);
    const matchesSearch = !normalizedSearchText || [entry.version, entry.revision, entry.failure_reason]
      .some((value) => value?.toLowerCase().includes(normalizedSearchText));
    const matchesSpeed = speed === "all" || getManagerDeploymentExcessDurationMs(
      getManagerDeploymentDurationMs(entry.started_at, entry.completed_at),
      speedThresholdMs,
    ) !== null;
    return matchesStatus && matchesFailureStage && matchesSearch && matchesSpeed;
  });

  return {
    durationStats,
    filteredEntries,
    periodComparison,
    resolveEntrySource,
    speedThresholdMs,
    summaryCurrentCount,
    summaryEntries,
    visibleEntries,
  };
}

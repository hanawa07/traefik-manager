"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";
import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";

import {
  ManagerDeploymentHistoryControls,
} from "./ManagerDeploymentHistoryControls";
import { ManagerDeploymentDurationTrend } from "./ManagerDeploymentDurationTrend";
import { ManagerDeploymentHistoryItem } from "./ManagerDeploymentHistoryItem";
import {
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS,
  MANAGER_DEPLOYMENT_FILTER_OPTIONS,
  MANAGER_DEPLOYMENT_PERIOD_OPTIONS,
  getManagerDeploymentDurationMs,
  getManagerDeploymentDurationStats,
  getManagerDeploymentExcessDurationMs,
  getManagerDeploymentSpeedThresholdMs,
} from "./managerDeploymentHistoryDisplay";
import {
  downloadManagerDeploymentHistory,
  type ManagerDeploymentHistoryExportFormat,
} from "./managerDeploymentHistoryExport";
import {
  DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
  MANAGER_DEPLOYMENT_HISTORY_QUERY,
  matchesManagerDeploymentHistoryStatus,
  parseManagerDeploymentHistoryDate,
  parseManagerDeploymentBottleneckThreshold,
  parseManagerDeploymentHistoryPeriod,
  parseManagerDeploymentHistorySource,
  parseManagerDeploymentHistorySpeed,
  parseManagerDeploymentHistoryStage,
  parseManagerDeploymentHistoryStatus,
  replaceManagerDeploymentHistoryQueryParams,
  type ManagerDeploymentHistoryFilters,
  type ManagerDeploymentHistoryPeriodFilter,
  type ManagerDeploymentHistoryRecordSource,
  type ManagerDeploymentHistorySourceFilter,
  type ManagerDeploymentHistorySpeedFilter,
  type ManagerDeploymentHistoryStageFilter,
  type ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";
import {
  getManagerDeploymentDateBoundary,
  getManagerDeploymentPeriodComparison,
} from "./managerDeploymentPeriodComparison";

interface ManagerDeploymentHistoryProps {
  archiveEntries?: ManagerDeploymentHistoryEntry[];
  entries?: ManagerDeploymentHistoryEntry[];
  source?: string | null;
  timezone?: string;
}

export function ManagerDeploymentHistory(props: ManagerDeploymentHistoryProps) {
  return (
    <Suspense fallback={null}>
      <ManagerDeploymentHistoryContent {...props} />
    </Suspense>
  );
}

function ManagerDeploymentHistoryContent({
  archiveEntries = [],
  entries = [],
  source,
  timezone,
}: ManagerDeploymentHistoryProps) {
  const searchParams = useSearchParams();
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  const [bottleneckThreshold, setBottleneckThreshold] = useState(() =>
    parseManagerDeploymentBottleneckThreshold(
      searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.bottleneckThreshold),
    ));
  const [dateFrom, setDateFrom] = useState(() =>
    parseManagerDeploymentHistoryDate(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.dateFrom)),
  );
  const [dateTo, setDateTo] = useState(() =>
    parseManagerDeploymentHistoryDate(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.dateTo)),
  );
  const [period, setPeriod] = useState<ManagerDeploymentHistoryPeriodFilter>(() =>
    parseManagerDeploymentHistoryPeriod(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.period)),
  );
  const [status, setStatus] = useState<ManagerDeploymentHistoryStatusFilter>(() =>
    parseManagerDeploymentHistoryStatus(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.status)),
  );
  const [stage, setStage] = useState<ManagerDeploymentHistoryStageFilter>(() =>
    parseManagerDeploymentHistoryStage(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.stage)),
  );
  const [historySource, setHistorySource] = useState<ManagerDeploymentHistorySourceFilter>(() =>
    parseManagerDeploymentHistorySource(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.source)),
  );
  const [speed, setSpeed] = useState<ManagerDeploymentHistorySpeedFilter>(() =>
    parseManagerDeploymentHistorySpeed(searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.speed)),
  );
  const [searchText, setSearchText] = useState(() =>
    (searchParams.get(MANAGER_DEPLOYMENT_HISTORY_QUERY.search) || "").slice(0, 100),
  );
  const filters: ManagerDeploymentHistoryFilters = {
    bottleneckThreshold,
    dateFrom,
    dateTo,
    period,
    search: searchText,
    source: historySource,
    speed,
    stage,
    status,
  };
  const normalizedSearchText = searchText.trim().toLowerCase();
  const periodCutoff = period === "all"
    ? null
    : periodReferenceTime - Number(period) * 24 * 60 * 60 * 1_000;
  const dateFromCutoff = getManagerDeploymentDateBoundary(dateFrom);
  const dateToCutoff = getManagerDeploymentDateBoundary(dateTo, true);
  const visibleEntries = historySource === "archive"
    ? archiveEntries
    : historySource === "all"
      ? [...entries, ...archiveEntries]
      : entries;
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

  const updateFilters = (updates: Partial<ManagerDeploymentHistoryFilters>) => {
    const queryUpdates: [key: string, value: string, defaultValue: string][] = [];
    if (updates.bottleneckThreshold !== undefined) {
      setBottleneckThreshold(updates.bottleneckThreshold);
      queryUpdates.push([
        MANAGER_DEPLOYMENT_HISTORY_QUERY.bottleneckThreshold,
        updates.bottleneckThreshold,
        DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
      ]);
    }
    if (updates.dateFrom !== undefined) {
      setDateFrom(updates.dateFrom);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.dateFrom, updates.dateFrom, ""]);
    }
    if (updates.dateTo !== undefined) {
      setDateTo(updates.dateTo);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.dateTo, updates.dateTo, ""]);
    }
    if (updates.period !== undefined) {
      setPeriodReferenceTime(Date.now());
      setPeriod(updates.period);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.period, updates.period, "all"]);
    }
    if (updates.search !== undefined) {
      const nextSearch = updates.search.slice(0, 100);
      setSearchText(nextSearch);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.search, nextSearch, ""]);
    }
    if (updates.source !== undefined) {
      setHistorySource(updates.source);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.source, updates.source, "current"]);
    }
    if (updates.speed !== undefined) {
      setSpeed(updates.speed);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.speed, updates.speed, "all"]);
    }
    if (updates.stage !== undefined) {
      setStage(updates.stage);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.stage, updates.stage, "all"]);
    }
    if (updates.status !== undefined) {
      setStatus(updates.status);
      queryUpdates.push([MANAGER_DEPLOYMENT_HISTORY_QUERY.status, updates.status, "all"]);
    }
    replaceManagerDeploymentHistoryQueryParams(queryUpdates);
  };

  const handleExport = (format: ManagerDeploymentHistoryExportFormat) => {
    try {
      const filename = downloadManagerDeploymentHistory(
        filteredEntries,
        filters,
        format,
        historySource === "all" ? resolveEntrySource : undefined,
        timezone,
      );
      setToastNotice({
        detail: `${filename} · ${filteredEntries.length}건 · ${describeExportFilters(filters)}`,
        message: `${format.toUpperCase()} 내보내기 완료`,
        tone: "success",
      });
    } catch {
      setToastNotice({
        detail: "배포 이력 파일을 생성하지 못했습니다.",
        message: `${format.toUpperCase()} 내보내기 실패`,
        tone: "error",
      });
    }
  };

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToastNotice({ message: `${label} 복사 완료`, tone: "success" });
    } catch {
      setToastNotice({ message: `${label} 복사 실패`, tone: "error" });
    }
  };

  return (
    <>
      <ToastNotice notice={toastNotice} onClose={() => setToastNotice(null)} />
      <section
        className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/60"
        data-history-source={historySource}
        data-manager-deployment-history
      >
        <ManagerDeploymentHistoryControls
          archiveCount={archiveEntries.length}
          currentCount={entries.length}
          durationStats={durationStats}
          entries={visibleEntries}
          filteredCount={filteredEntries.length}
          filters={filters}
          onExport={handleExport}
          onFiltersChange={updateFilters}
          previousPeriodEntries={periodComparison?.entries ?? null}
          summaryCurrentCount={summaryCurrentCount}
          summaryEntries={summaryEntries}
        />

        <ManagerDeploymentDurationTrend
          comparison={periodComparison}
          entries={summaryEntries}
          speed={speed}
          stats={durationStats}
          timezone={timezone}
        />

        {visibleEntries.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            {historySource === "archive"
              ? "보관된 배포가 없습니다."
              : "기록된 blue-green 배포가 없습니다."}
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            선택한 필터의 배포 이력이 없습니다.
          </p>
        ) : (
          <ol className="mt-3 grid gap-2 lg:grid-cols-2">
            {filteredEntries.map((entry) => (
              <ManagerDeploymentHistoryItem
                bottleneckThresholdMs={Number(bottleneckThreshold)}
                entry={entry}
                entrySource={historySource === "all" ? resolveEntrySource(entry) : undefined}
                key={`${entry.completed_at}-${entry.to_slot}`}
                onCopy={handleCopy}
                previousVersion={visibleEntries[visibleEntries.indexOf(entry) + 1]?.version}
                searchText={searchText}
                source={source}
                thresholdDurationMs={speedThresholdMs}
                thresholdLabel={speed === "p95" ? "P95" : "평균"}
                timezone={timezone}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function describeExportFilters(filters: ManagerDeploymentHistoryFilters): string {
  const source = filters.source === "all"
    ? "현재·보관 통합"
    : filters.source === "archive" ? "보관 이력" : "최근";
  const period = filters.dateFrom || filters.dateTo
    ? `기간 ${filters.dateFrom || "처음"}~${filters.dateTo || "오늘"}`
    : MANAGER_DEPLOYMENT_PERIOD_OPTIONS.find((option) => option.value === filters.period)?.label;
  const status = MANAGER_DEPLOYMENT_FILTER_OPTIONS.find(
    (option) => option.value === filters.status,
  )?.label;
  const summary = [source, period, status];
  if (filters.speed !== "all") {
    summary.push(`속도 ${filters.speed === "p95" ? "P95" : "평균"} 초과`);
  }
  if (filters.bottleneckThreshold !== DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD) {
    const threshold = MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS.find(
      (option) => option.value === filters.bottleneckThreshold,
    )?.label;
    summary.push(`병목 경고 ${threshold}`);
  }
  if (filters.stage !== "all") {
    summary.push(`단계 ${filters.stage === "unknown"
      ? "미기록"
      : MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[filters.stage]}`);
  }
  if (filters.search.trim()) summary.push(`검색 "${filters.search.trim()}"`);
  return summary.filter(Boolean).join(" · ");
}

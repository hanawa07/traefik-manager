"use client";

import { Suspense, useState } from "react";

import type {
  ManagerDeploymentHistoryArchiveSummary,
  ManagerDeploymentHistoryEntry,
} from "@/features/deployment/api/deploymentApi";
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
} from "./managerDeploymentHistoryDisplay";
import {
  downloadManagerDeploymentHistory,
  type ManagerDeploymentHistoryExportFormat,
} from "./managerDeploymentHistoryExport";
import {
  DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
  type ManagerDeploymentHistoryFilters,
} from "./managerDeploymentHistoryQuery";
import { getManagerDeploymentHistoryView } from "./managerDeploymentHistoryView";
import { useManagerDeploymentHistoryFilters } from "./useManagerDeploymentHistoryFilters";

interface ManagerDeploymentHistoryProps {
  archiveEntries?: ManagerDeploymentHistoryEntry[];
  archiveSummary?: ManagerDeploymentHistoryArchiveSummary;
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
  archiveSummary,
  entries = [],
  source,
  timezone,
}: ManagerDeploymentHistoryProps) {
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const { filters, periodReferenceTime, updateFilters } = useManagerDeploymentHistoryFilters();
  const {
    bottleneckThreshold,
    search: searchText,
    source: historySource,
    speed,
  } = filters;
  const {
    durationStats,
    filteredEntries,
    periodComparison,
    resolveEntrySource,
    speedThresholdMs,
    summaryCurrentCount,
    summaryEntries,
    visibleEntries,
  } = getManagerDeploymentHistoryView({
    archiveEntries,
    entries,
    filters,
    periodReferenceTime,
  });

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
          archiveSummary={archiveSummary}
          currentCount={entries.length}
          detailEntries={filteredEntries}
          durationStats={durationStats}
          entries={visibleEntries}
          filteredCount={filteredEntries.length}
          filters={filters}
          onExport={handleExport}
          onFiltersChange={updateFilters}
          previousPeriodEntries={periodComparison?.entries ?? null}
          summaryCurrentCount={summaryCurrentCount}
          summaryEntries={summaryEntries}
          timezone={timezone}
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
  if (filters.archiveSample !== "all") {
    summary.splice(1, 0, filters.archiveSample === "detailed" ? "상세 표본" : "일별 표본");
  }
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

import { History } from "lucide-react";

import type {
  ManagerDeploymentHistoryArchiveSummary as ManagerDeploymentHistoryArchiveSummaryValue,
  ManagerDeploymentHistoryEntry,
} from "@/features/deployment/api/deploymentApi";

import {
  type ManagerDeploymentDurationStats,
  MANAGER_DEPLOYMENT_FILTER_OPTIONS,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistoryExportFormat } from "./managerDeploymentHistoryExport";
import {
  matchesManagerDeploymentHistoryStatus,
  type ManagerDeploymentHistoryFilters,
  type ManagerDeploymentHistorySourceFilter,
} from "./managerDeploymentHistoryQuery";
import { ManagerDeploymentBottleneckAlert } from "./ManagerDeploymentBottleneckAlert";
import { ManagerDeploymentFailureSummary } from "./ManagerDeploymentFailureSummary";
import { ManagerDeploymentHistoryActiveConditions } from "./ManagerDeploymentHistoryActiveConditions";
import { ManagerDeploymentHistoryArchiveSummary } from "./ManagerDeploymentHistoryArchiveSummary";
import { ManagerDeploymentHistoryPrimaryFilters } from "./ManagerDeploymentHistoryPrimaryFilters";
import { ManagerDeploymentOutcomeSummary } from "./ManagerDeploymentOutcomeSummary";
import { ManagerDeploymentStageComparison } from "./ManagerDeploymentStageComparison";
import { ManagerDeploymentStageSummary } from "./ManagerDeploymentStageSummary";

interface ManagerDeploymentHistoryControlsProps {
  archiveCount: number;
  archiveSummary?: ManagerDeploymentHistoryArchiveSummaryValue;
  currentCount: number;
  detailEntries: ManagerDeploymentHistoryEntry[];
  durationStats: ManagerDeploymentDurationStats;
  entries: ManagerDeploymentHistoryEntry[];
  filteredCount: number;
  filters: ManagerDeploymentHistoryFilters;
  onExport: (format: ManagerDeploymentHistoryExportFormat) => void;
  onFiltersChange: (updates: Partial<ManagerDeploymentHistoryFilters>) => void;
  previousPeriodEntries: ManagerDeploymentHistoryEntry[] | null;
  summaryCurrentCount: number;
  summaryEntries: ManagerDeploymentHistoryEntry[];
  timezone?: string;
}

export function ManagerDeploymentHistoryControls({
  archiveCount,
  archiveSummary,
  currentCount,
  detailEntries,
  durationStats,
  entries,
  filteredCount,
  filters,
  onExport,
  onFiltersChange,
  previousPeriodEntries,
  summaryCurrentCount,
  summaryEntries,
  timezone,
}: ManagerDeploymentHistoryControlsProps) {
  const sourceLabel = filters.source === "all"
    ? "현재·보관 통합"
    : filters.source === "archive"
      ? "보관 이력"
      : "최근";
  const sourceOptions: {
    label: string;
    value: ManagerDeploymentHistorySourceFilter;
  }[] = [
    { label: `최근 ${currentCount}`, value: "current" },
    { label: `통합 ${currentCount + archiveCount}`, value: "all" },
    { label: `보관 이력 ${archiveCount}`, value: "archive" },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            배포 전환 이력
          </h3>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {sourceLabel} {entries.length}건
          </span>
        </div>
        <div className="flex flex-wrap gap-1 sm:ml-auto">
          {archiveCount > 0 || filters.source !== "current" ? sourceOptions.map((option) => (
            <button
              aria-pressed={filters.source === option.value}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                filters.source === option.value
                  ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
              }`}
              data-history-source-filter={option.value}
              key={option.value}
              onClick={() => onFiltersChange({
                source: option.value,
                stage: "all",
                status: "all",
              })}
              type="button"
            >
              {option.label}
            </button>
          )) : null}
          {entries.length > 0 ? (["json", "csv"] as const).map((format) => (
            <button
              aria-label={`현재 결과 ${filteredCount}건 ${format.toUpperCase()} 내보내기`}
              className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
              data-history-export={format}
              key={format}
              onClick={() => onExport(format)}
              type="button"
            >
              {format.toUpperCase()} 내보내기 · {filteredCount}건
            </button>
          )) : null}
        </div>
      </div>

      <ManagerDeploymentBottleneckAlert
        entries={summaryEntries}
        threshold={filters.bottleneckThreshold}
      />

      <ManagerDeploymentHistoryArchiveSummary summary={archiveSummary} timezone={timezone} />

      {entries.length > 0 ? (
        <details className="mt-2 text-[11px] text-gray-500 dark:text-slate-400" data-history-export-help>
          <summary className="w-fit cursor-pointer font-semibold text-gray-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-200">
            내보내기 형식
          </summary>
          <p className="mt-1 leading-relaxed">
            JSON은 스키마 버전·시간대·적용 필터가 담긴 metadata와 entries로 구성됩니다.
            CSV는 상단 metadata,value 블록 다음 빈 줄 아래에 데이터 표가 이어집니다.
          </p>
        </details>
      ) : null}

      {entries.length > 0 ? (
        <ManagerDeploymentHistoryPrimaryFilters
          archiveCount={archiveCount}
          archiveSummary={archiveSummary}
          entriesCount={entries.length}
          filteredCount={filteredCount}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      ) : null}

      {entries.length > 0 ? (
        <ManagerDeploymentOutcomeSummary
          currentSourceCount={filters.source === "all" ? summaryCurrentCount : undefined}
          durationStats={durationStats}
          entries={summaryEntries}
          onSpeedChange={(speedFilter) => onFiltersChange({ speed: speedFilter })}
          onStatusChange={(status) => onFiltersChange({ status })}
          selectedSpeed={filters.speed}
          selectedStatus={filters.status}
        />
      ) : null}

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="배포 이력 상태 필터">
          {MANAGER_DEPLOYMENT_FILTER_OPTIONS.map((option) => {
            const count = option.value === "all"
              ? summaryEntries.length
              : summaryEntries.filter(
                  (entry) => matchesManagerDeploymentHistoryStatus(entry, option.value),
                ).length;
            const active = filters.status === option.value;
            return (
              <button
                aria-pressed={active}
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
                }`}
                data-history-filter={option.value}
                key={option.value}
                onClick={() => onFiltersChange({ status: option.value })}
                type="button"
              >
                {option.label} {count}
              </button>
            );
          })}
        </div>
      ) : null}

      <ManagerDeploymentFailureSummary
        entries={summaryEntries}
        onStageChange={(stage) => onFiltersChange({ stage })}
        selectedStage={filters.stage}
      />

      <ManagerDeploymentStageSummary
        entries={summaryEntries}
        onThresholdChange={(threshold) => onFiltersChange({ bottleneckThreshold: threshold })}
        threshold={filters.bottleneckThreshold}
      />

      <ManagerDeploymentStageComparison
        currentEntries={summaryEntries}
        detailEntries={detailEntries}
        previousEntries={previousPeriodEntries}
      />

      {entries.length > 0 ? (
        <ManagerDeploymentHistoryActiveConditions
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      ) : null}
    </>
  );
}

import { RotateCcw, Search } from "lucide-react";

import type { ManagerDeploymentHistoryArchiveSummary } from "@/features/deployment/api/deploymentApi";

import { MANAGER_DEPLOYMENT_PERIOD_OPTIONS } from "./managerDeploymentHistoryDisplay";
import {
  DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
  type ManagerDeploymentArchiveSampleFilter,
  type ManagerDeploymentHistoryFilters,
  type ManagerDeploymentHistoryPeriodFilter,
} from "./managerDeploymentHistoryQuery";
import { ManagerDeploymentDateRange } from "./ManagerDeploymentDateRange";

interface ManagerDeploymentHistoryPrimaryFiltersProps {
  archiveCount: number;
  archiveSummary?: ManagerDeploymentHistoryArchiveSummary;
  entriesCount: number;
  filteredCount: number;
  filters: ManagerDeploymentHistoryFilters;
  onFiltersChange: (updates: Partial<ManagerDeploymentHistoryFilters>) => void;
}

export function ManagerDeploymentHistoryPrimaryFilters({
  archiveCount,
  archiveSummary,
  entriesCount,
  filteredCount,
  filters,
  onFiltersChange,
}: ManagerDeploymentHistoryPrimaryFiltersProps) {
  const hasActiveFilters =
    filters.status !== "all" ||
    filters.archiveSample !== "all" ||
    filters.bottleneckThreshold !== DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD ||
    filters.speed !== "all" ||
    filters.stage !== "all" ||
    filters.period !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.search.trim() !== "";

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
          <span className="sr-only">배포 이력 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            aria-label="배포 이력 검색"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            data-history-search
            maxLength={100}
            onChange={(event) => onFiltersChange({ search: event.target.value.slice(0, 100) })}
            placeholder="버전·커밋·실패 원인 검색"
            spellCheck={false}
            type="search"
            value={filters.search}
          />
        </label>
        <label className="min-w-36 text-[11px] font-medium text-gray-500 dark:text-slate-400">
          <span className="sr-only">배포 이력 기간</span>
          <select
            aria-label="배포 이력 기간"
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-history-period
            onChange={(event) =>
              onFiltersChange({
                dateFrom: "",
                dateTo: "",
                period: event.target.value as ManagerDeploymentHistoryPeriodFilter,
              })
            }
            value={filters.period}
          >
            {MANAGER_DEPLOYMENT_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {filters.source !== "current" && archiveCount > 0 ? (
          <label className="min-w-36 text-[11px] font-medium text-gray-500 dark:text-slate-400">
            <span className="sr-only">보관 이력 표본</span>
            <select
              aria-label="보관 이력 표본"
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              data-history-archive-sample
              onChange={(event) =>
                onFiltersChange({
                  archiveSample: event.target.value as ManagerDeploymentArchiveSampleFilter,
                })
              }
              value={filters.archiveSample}
            >
              <option value="all">보관 표본 전체</option>
              <option value="detailed">상세 표본 {archiveSummary?.detailed_count ?? 0}</option>
              <option value="daily">일별 표본 {archiveSummary?.daily_count ?? 0}</option>
            </select>
          </label>
        ) : null}
        <span aria-live="polite" className="text-[11px] text-gray-500 dark:text-slate-400">
          {filteredCount}/{entriesCount}건
        </span>
        <button
          aria-label="배포 이력 필터 초기화"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
          data-history-filter-reset
          disabled={!hasActiveFilters}
          onClick={() =>
            onFiltersChange({
              archiveSample: "all",
              bottleneckThreshold: DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
              dateFrom: "",
              dateTo: "",
              period: "all",
              search: "",
              speed: "all",
              stage: "all",
              status: "all",
            })
          }
          type="button"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          필터 초기화
        </button>
      </div>

      <ManagerDeploymentDateRange
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onChange={(dates) => onFiltersChange({ ...dates, period: "all" })}
      />
    </>
  );
}

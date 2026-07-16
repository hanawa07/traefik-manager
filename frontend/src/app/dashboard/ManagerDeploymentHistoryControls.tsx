import { History, RotateCcw, Search, X } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  MANAGER_DEPLOYMENT_FILTER_OPTIONS,
  MANAGER_DEPLOYMENT_PERIOD_OPTIONS,
  MANAGER_DEPLOYMENT_STATUS_DISPLAY,
} from "./managerDeploymentHistoryDisplay";
import type { ManagerDeploymentHistoryExportFormat } from "./managerDeploymentHistoryExport";
import type {
  ManagerDeploymentHistoryPeriodFilter,
  ManagerDeploymentHistorySourceFilter,
  ManagerDeploymentHistoryStageFilter,
  ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";
import { ManagerDeploymentDateRange } from "./ManagerDeploymentDateRange";
import { ManagerDeploymentFailureSummary } from "./ManagerDeploymentFailureSummary";
import { ManagerDeploymentOutcomeSummary } from "./ManagerDeploymentOutcomeSummary";

export interface ManagerDeploymentHistoryFilters {
  dateFrom: string;
  dateTo: string;
  period: ManagerDeploymentHistoryPeriodFilter;
  search: string;
  source: ManagerDeploymentHistorySourceFilter;
  stage: ManagerDeploymentHistoryStageFilter;
  status: ManagerDeploymentHistoryStatusFilter;
}

interface ManagerDeploymentHistoryControlsProps {
  archiveCount: number;
  currentCount: number;
  entries: ManagerDeploymentHistoryEntry[];
  filteredCount: number;
  filters: ManagerDeploymentHistoryFilters;
  onExport: (format: ManagerDeploymentHistoryExportFormat) => void;
  onFiltersChange: (updates: Partial<ManagerDeploymentHistoryFilters>) => void;
  summaryEntries: ManagerDeploymentHistoryEntry[];
}

export function ManagerDeploymentHistoryControls({
  archiveCount,
  currentCount,
  entries,
  filteredCount,
  filters,
  onExport,
  onFiltersChange,
  summaryEntries,
}: ManagerDeploymentHistoryControlsProps) {
  const sourceLabel = filters.source === "all"
    ? "현재·보관 통합"
    : filters.source === "archive"
      ? "회전 보관"
      : "최근";
  const sourceOptions: { label: string; value: ManagerDeploymentHistorySourceFilter }[] = [
    { label: `최근 ${currentCount}`, value: "current" },
    { label: `통합 ${currentCount + archiveCount}`, value: "all" },
    { label: `회전 보관 ${archiveCount}`, value: "archive" },
  ];
  const hasActiveFilters = filters.status !== "all"
    || filters.stage !== "all"
    || filters.period !== "all"
    || filters.dateFrom !== ""
    || filters.dateTo !== ""
    || filters.search.trim() !== "";
  const hasActiveConditions = filters.source !== "current" || hasActiveFilters;
  const selectedStageLabel = filters.stage === "unknown"
    ? "단계 미기록"
    : filters.stage === "all"
      ? null
      : MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[filters.stage];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">배포 전환 이력</h3>
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
              aria-label={`현재 화면 ${format.toUpperCase()} 내보내기`}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
              data-history-export={format}
              key={format}
              onClick={() => onExport(format)}
              type="button"
            >
              {format.toUpperCase()} 내보내기
            </button>
          )) : null}
        </div>
      </div>

      {entries.length > 0 ? (
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
              onChange={(event) => onFiltersChange({
                dateFrom: "",
                dateTo: "",
                period: event.target.value as ManagerDeploymentHistoryPeriodFilter,
              })}
              value={filters.period}
            >
              {MANAGER_DEPLOYMENT_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <span aria-live="polite" className="text-[11px] text-gray-500 dark:text-slate-400">
            {filteredCount}/{entries.length}건
          </span>
          <button
            aria-label="배포 이력 필터 초기화"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            data-history-filter-reset
            disabled={!hasActiveFilters}
            onClick={() => onFiltersChange({
              dateFrom: "",
              dateTo: "",
              period: "all",
              search: "",
              stage: "all",
              status: "all",
            })}
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            필터 초기화
          </button>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ManagerDeploymentDateRange
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(dates) => onFiltersChange({ ...dates, period: "all" })}
        />
      ) : null}

      {entries.length > 0 ? <ManagerDeploymentOutcomeSummary entries={summaryEntries} /> : null}

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="배포 이력 상태 필터">
          {MANAGER_DEPLOYMENT_FILTER_OPTIONS.map((option) => {
            const count = option.value === "all"
              ? summaryEntries.length
              : summaryEntries.filter((entry) => entry.status === option.value).length;
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

      {entries.length > 0 ? (
        <div
          aria-live="polite"
          className="mt-3 flex min-h-9 flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 text-[11px] dark:border-slate-800"
          data-history-active-conditions
        >
          <span className="font-semibold text-slate-600 dark:text-slate-300">적용 조건</span>
          {!hasActiveConditions ? (
            <span className="text-slate-500 dark:text-slate-400">전체 이력</span>
          ) : (
            <>
              {filters.source !== "current" ? (
                <ConditionChip
                  condition="source"
                  label={filters.source === "all" ? "현재·보관 통합" : "회전 보관"}
                  onRemove={() => onFiltersChange({ source: "current" })}
                />
              ) : null}
              {filters.period !== "all" ? (
                <ConditionChip
                  condition="period"
                  label={`기간: ${MANAGER_DEPLOYMENT_PERIOD_OPTIONS.find(
                    (option) => option.value === filters.period,
                  )?.label}`}
                  onRemove={() => onFiltersChange({ period: "all" })}
                />
              ) : null}
              {filters.dateFrom ? (
                <ConditionChip
                  condition="date_from"
                  label={`시작일: ${filters.dateFrom}`}
                  onRemove={() => onFiltersChange({ dateFrom: "" })}
                />
              ) : null}
              {filters.dateTo ? (
                <ConditionChip
                  condition="date_to"
                  label={`종료일: ${filters.dateTo}`}
                  onRemove={() => onFiltersChange({ dateTo: "" })}
                />
              ) : null}
              {filters.status !== "all" ? (
                <ConditionChip
                  condition="status"
                  label={`상태: ${MANAGER_DEPLOYMENT_STATUS_DISPLAY[filters.status].label}`}
                  onRemove={() => onFiltersChange({ status: "all" })}
                />
              ) : null}
              {selectedStageLabel ? (
                <ConditionChip
                  condition="stage"
                  label={`단계: ${selectedStageLabel}`}
                  onRemove={() => onFiltersChange({ stage: "all" })}
                />
              ) : null}
              {filters.search.trim() ? (
                <ConditionChip
                  condition="search"
                  label={`검색: ${filters.search.trim()}`}
                  onRemove={() => onFiltersChange({ search: "" })}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

function ConditionChip({
  condition,
  label,
  onRemove,
}: {
  condition: "date_from" | "date_to" | "period" | "search" | "source" | "stage" | "status";
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      aria-label={`${label} 조건 제거`}
      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25"
      data-history-condition={condition}
      onClick={onRemove}
      type="button"
    >
      {label}
      <X aria-hidden="true" className="h-3 w-3" />
    </button>
  );
}

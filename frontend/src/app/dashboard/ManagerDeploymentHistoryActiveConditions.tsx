import { X } from "lucide-react";

import {
  MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  MANAGER_DEPLOYMENT_FILTER_OPTIONS,
  MANAGER_DEPLOYMENT_PERIOD_OPTIONS,
} from "./managerDeploymentHistoryDisplay";
import {
  DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
  type ManagerDeploymentHistoryFilters,
} from "./managerDeploymentHistoryQuery";

interface ManagerDeploymentHistoryActiveConditionsProps {
  filters: ManagerDeploymentHistoryFilters;
  onFiltersChange: (updates: Partial<ManagerDeploymentHistoryFilters>) => void;
}

export function ManagerDeploymentHistoryActiveConditions({
  filters,
  onFiltersChange,
}: ManagerDeploymentHistoryActiveConditionsProps) {
  const hasActiveConditions = filters.source !== "current"
    || filters.status !== "all"
    || filters.archiveSample !== "all"
    || filters.bottleneckThreshold !== DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD
    || filters.speed !== "all"
    || filters.stage !== "all"
    || filters.period !== "all"
    || filters.dateFrom !== ""
    || filters.dateTo !== ""
    || filters.search.trim() !== "";
  const selectedStageLabel = filters.stage === "unknown"
    ? "단계 미기록"
    : filters.stage === "all"
      ? null
      : MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[filters.stage];
  const selectedStatusLabel = MANAGER_DEPLOYMENT_FILTER_OPTIONS.find(
    (option) => option.value === filters.status,
  )?.label;

  return (
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
              label={filters.source === "all" ? "현재·보관 통합" : "보관 이력"}
              onRemove={() => onFiltersChange({ source: "current" })}
            />
          ) : null}
          {filters.archiveSample !== "all" ? (
            <ConditionChip
              condition="archive_sample"
              label={filters.archiveSample === "detailed" ? "상세 표본" : "일별 표본"}
              onRemove={() => onFiltersChange({ archiveSample: "all" })}
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
              label={`상태: ${selectedStatusLabel}`}
              onRemove={() => onFiltersChange({ status: "all" })}
            />
          ) : null}
          {filters.speed !== "all" ? (
            <ConditionChip
              condition="speed"
              label={`속도: ${filters.speed === "p95" ? "P95" : "평균"} 초과`}
              onRemove={() => onFiltersChange({ speed: "all" })}
            />
          ) : null}
          {filters.bottleneckThreshold !== DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD ? (
            <ConditionChip
              condition="bottleneck_threshold"
              label={`병목 경고: ${MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD_OPTIONS.find(
                (option) => option.value === filters.bottleneckThreshold,
              )?.label}`}
              onRemove={() => onFiltersChange({
                bottleneckThreshold: DEFAULT_MANAGER_DEPLOYMENT_BOTTLENECK_THRESHOLD,
              })}
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
  );
}

function ConditionChip({
  condition,
  label,
  onRemove,
}: {
  condition:
    | "archive_sample"
    | "bottleneck_threshold"
    | "date_from"
    | "date_to"
    | "period"
    | "search"
    | "source"
    | "speed"
    | "stage"
    | "status";
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

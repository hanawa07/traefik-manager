"use client";

import { RotateCcw, X } from "lucide-react";

import type { SmokeFailureMetadataFilters } from "@/features/settings/lib/smokeFailureMetadataFilters";
import { SMOKE_FAILURE_TYPE_LABELS } from "@/features/settings/lib/smokeFailureMetadataLabels";

interface SmokeFailureMetadataActiveFiltersProps {
  filters: SmokeFailureMetadataFilters;
  onClearAll: () => void;
  onClearPeriod: () => void;
  onClearQuery: () => void;
  onClearSort: () => void;
  onClearType: () => void;
}

const PERIOD_LABELS = {
  "7": "최근 7일",
  "30": "최근 30일",
} as const;

const SORT_LABELS = {
  oldest: "오래된순",
  run_asc: "실행 번호 낮은순",
  run_desc: "실행 번호 높은순",
} as const;

export function SmokeFailureMetadataActiveFilters({
  filters,
  onClearAll,
  onClearPeriod,
  onClearQuery,
  onClearSort,
  onClearType,
}: SmokeFailureMetadataActiveFiltersProps) {
  const typeLabel = filters.type === "all" ? "" : SMOKE_FAILURE_TYPE_LABELS[filters.type];
  const periodLabel = filters.period === "all"
    ? ""
    : filters.period === "custom"
      ? [filters.startDate || "시작 없음", filters.endDate || "종료 없음"].join(" ~ ")
      : PERIOD_LABELS[filters.period];
  const queryLabel = filters.query.trim() || (filters.query ? "공백" : "");
  const sortLabel = filters.sort === "newest" ? "" : SORT_LABELS[filters.sort];
  if (!typeLabel && !periodLabel && !queryLabel && !sortLabel) return null;

  return (
    <div
      aria-label="적용 중인 실패 정보 필터"
      className="mt-2 flex flex-wrap items-center gap-1.5"
      data-testid="smoke-failure-metadata-active-filters"
    >
      <span className="mr-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">
        적용 조건
      </span>
      {typeLabel ? (
        <FilterChip
          label={`유형: ${typeLabel}`}
          onClear={onClearType}
          testId="smoke-failure-metadata-active-filter-type"
        />
      ) : null}
      {periodLabel ? (
        <FilterChip
          label={`기간: ${periodLabel}`}
          onClear={onClearPeriod}
          testId="smoke-failure-metadata-active-filter-period"
        />
      ) : null}
      {queryLabel ? (
        <FilterChip
          label={`검색: ${queryLabel}`}
          onClear={onClearQuery}
          testId="smoke-failure-metadata-active-filter-query"
        />
      ) : null}
      {sortLabel ? (
        <FilterChip
          label={`정렬: ${sortLabel}`}
          onClear={onClearSort}
          testId="smoke-failure-metadata-active-filter-sort"
        />
      ) : null}
      <button
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        data-testid="smoke-failure-metadata-active-filter-clear-all"
        onClick={onClearAll}
        type="button"
      >
        <RotateCcw className="h-3 w-3" /> 전체 초기화
      </button>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onClear: () => void;
  testId: string;
}

function FilterChip({ label, onClear, testId }: FilterChipProps) {
  return (
    <button
      aria-label={`${label} 해제`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-950/70"
      data-testid={testId}
      onClick={onClear}
      title={`${label} 해제`}
      type="button"
    >
      <span className="max-w-64 truncate">{label}</span>
      <X className="h-3 w-3 shrink-0" />
    </button>
  );
}

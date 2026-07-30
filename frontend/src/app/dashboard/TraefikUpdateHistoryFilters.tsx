import { Download, RotateCcw } from "lucide-react";

import {
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  type TraefikUpdateHistoryFilters,
  type TraefikUpdateHistoryPeriod,
  type TraefikUpdateHistoryRetry,
  type TraefikUpdateHistoryStatus,
} from "./traefikUpdateHistoryFilter";
import type { TraefikUpdateHistoryExportFormat } from "./traefikUpdateHistoryExport";

const STATUS_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryStatus }[] = [
  { label: "전체 상태", value: "all" },
  { label: "완료", value: "success" },
  { label: "처리 중", value: "running" },
  { label: "요청 거부", value: "rejected" },
  { label: "자동 롤백", value: "rolled_back" },
  { label: "롤백 실패", value: "rollback_failed" },
];

const PERIOD_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryPeriod }[] = [
  { label: "전체 기간", value: "all" },
  { label: "최근 24시간", value: "1" },
  { label: "최근 7일", value: "7" },
  { label: "최근 30일", value: "30" },
  { label: "최근 90일", value: "90" },
];

const RETRY_OPTIONS: readonly { label: string; value: TraefikUpdateHistoryRetry }[] = [
  { label: "재시도 전체", value: "all" },
  { label: "재시도 있음", value: "retried" },
  { label: "재시도 없음", value: "not_retried" },
];

interface TraefikUpdateHistoryFiltersProps {
  dateRangeValid: boolean;
  displayedCount: number;
  filteredCount: number;
  filters: TraefikUpdateHistoryFilters;
  onExport: (format: TraefikUpdateHistoryExportFormat) => void;
  onFiltersChange: (updates: Partial<TraefikUpdateHistoryFilters>) => void;
  onPeriodChange: (period: TraefikUpdateHistoryPeriod) => void;
  totalCount: number;
}

export function TraefikUpdateHistoryFilters({
  dateRangeValid,
  displayedCount,
  filteredCount,
  filters,
  onExport,
  onFiltersChange,
  onPeriodChange,
  totalCount,
}: TraefikUpdateHistoryFiltersProps) {
  const hasActiveFilters = filters.status !== "all"
    || filters.period !== "all"
    || filters.retry !== "all"
    || Boolean(filters.actor.trim())
    || Boolean(filters.dateFrom)
    || Boolean(filters.dateTo);
  const controlClassName = "min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/80">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          업데이트 상태
          <select
            aria-label="업데이트 이력 상태"
            className={controlClassName}
            data-traefik-update-status-filter
            onChange={(event) => onFiltersChange({
              status: event.target.value as TraefikUpdateHistoryStatus,
            })}
            value={filters.status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          요청자 또는 요청 ID
          <input
            aria-label="업데이트 이력 요청자 또는 요청 ID"
            className={controlClassName}
            data-traefik-update-actor-filter
            maxLength={100}
            onChange={(event) => onFiltersChange({ actor: event.target.value })}
            placeholder="요청자 또는 요청 UUID"
            type="search"
            value={filters.actor}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          재시도 여부
          <select
            aria-label="업데이트 이력 재시도 여부"
            className={controlClassName}
            data-traefik-update-retry-filter
            onChange={(event) => onFiltersChange({
              retry: event.target.value as TraefikUpdateHistoryRetry,
            })}
            value={filters.retry}
          >
            {RETRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          상대 기간
          <select
            aria-label="업데이트 이력 기간"
            className={controlClassName}
            data-traefik-update-period-filter
            onChange={(event) => onPeriodChange(
              event.target.value as TraefikUpdateHistoryPeriod,
            )}
            value={filters.period}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          시작일
          <input
            aria-label="업데이트 이력 시작일"
            className={controlClassName}
            data-traefik-update-date-from
            max={filters.dateTo || undefined}
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value, period: "all" })}
            type="date"
            value={filters.dateFrom}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          종료일
          <input
            aria-label="업데이트 이력 종료일"
            className={controlClassName}
            data-traefik-update-date-to
            min={filters.dateFrom || undefined}
            onChange={(event) => onFiltersChange({ dateTo: event.target.value, period: "all" })}
            type="date"
            value={filters.dateTo}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
        <span aria-live="polite" className="text-[11px] text-slate-500 dark:text-slate-400">
          현재 결과 {filteredCount}/{totalCount}건
          {displayedCount < filteredCount ? ` · 화면 ${displayedCount}건` : ""}
        </span>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {(["json", "csv"] as const).map((format) => (
            <button
              aria-label={`현재 업데이트 이력 ${filteredCount}건 ${format.toUpperCase()} 다운로드`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
              data-traefik-update-export={format}
              disabled={!dateRangeValid || filteredCount === 0}
              key={format}
              onClick={() => onExport(format)}
              type="button"
            >
              <Download className="h-3 w-3" /> {format.toUpperCase()}
            </button>
          ))}
          <button
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
            data-traefik-update-filter-reset
            disabled={!hasActiveFilters}
            onClick={() => onFiltersChange(DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS)}
            type="button"
          >
            <RotateCcw className="h-3 w-3" /> 초기화
          </button>
        </div>
      </div>
    </div>
  );
}

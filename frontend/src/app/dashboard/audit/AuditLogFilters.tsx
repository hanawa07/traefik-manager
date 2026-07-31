import { clsx } from "clsx";
import { RotateCcw, Search, X } from "lucide-react";

import type { AuditManagerHealthSummary } from "@/features/audit/api/auditApi";

import { auditFilters } from "./auditPageHelpers";
import {
  buildAuditActiveConditions,
  type AuditActiveConditionInput,
} from "./auditLogActiveConditions";
import { AuditLogAdvancedFilters } from "./AuditLogAdvancedFilters";

interface AuditLogFiltersProps extends AuditActiveConditionInput {
  managerHealthCounts?: AuditManagerHealthSummary;
  delayedRetryCount?: number;
  onResetFilters: () => void;
}

export function AuditLogFilters(props: AuditLogFiltersProps) {
  const {
    selectedFilter,
    selectedDeliveryStatus,
    selectedDeliveryProvider,
    selectedManagerSource,
    selectedManagerStatus,
    selectedPeriod,
    startDate,
    endDate,
    managerHealthCounts,
    delayedRetryCount,
    managerHealthWindowMinutes,
    searchText,
    onFilterChange,
    onManagerSourceChange,
    onManagerStatusChange,
    onManagerHealthWindowChange,
    onDateRangeChange,
    onPeriodChange,
    onResetFilters,
    onSearchTextChange,
    onDeliveryStatusChange,
    onDeliveryProviderChange,
  } = props;
  const activeConditions = buildAuditActiveConditions(props);

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {auditFilters.map((filter) => {
          const active = selectedFilter === filter.key;
          return (
            <button
              key={filter.key}
              aria-pressed={active}
              data-audit-count={filter.key === "delayed_retry" ? delayedRetryCount : undefined}
              data-audit-filter={filter.key}
              type="button"
              onClick={() => onFilterChange(filter.key)}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-blue-300 bg-blue-100 text-slate-950 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800",
              )}
            >
              {filter.label}
              {filter.key === "delayed_retry" && delayedRetryCount !== undefined
                ? ` (${delayedRetryCount})`
                : ""}
            </button>
          );
        })}
      </div>

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Search className="h-3.5 w-3.5" />
            감사 로그 검색
          </span>
          <input
            aria-label="감사 로그 검색"
            autoComplete="off"
            maxLength={100}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="행위자, 대상 이름 또는 ID 검색"
            spellCheck={false}
            type="search"
            value={searchText}
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>
        <button
          aria-label="감사 필터 전체 초기화"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none dark:hover:border-blue-500 dark:hover:text-blue-200 lg:self-stretch"
          disabled={activeConditions.length === 0}
          onClick={onResetFilters}
          type="button"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          전체 초기화
        </button>
      </div>

      <div
        aria-live="polite"
        className="mb-4 flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60"
      >
        <span className="font-semibold text-slate-600 dark:text-slate-300">적용 조건</span>
        {activeConditions.length === 0 ? (
          <span className="text-slate-500 dark:text-slate-400">전체 로그</span>
        ) : (
          activeConditions.map((condition) => (
            <button
              aria-label={`${condition.label} 조건 제거`}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25"
              key={condition.key}
              onClick={condition.onRemove}
              type="button"
            >
              {condition.label}
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          ))
        )}
      </div>

      <AuditLogAdvancedFilters
        endDate={endDate}
        managerHealthCounts={managerHealthCounts}
        managerHealthWindowMinutes={managerHealthWindowMinutes}
        onDateRangeChange={onDateRangeChange}
        onDeliveryProviderChange={onDeliveryProviderChange}
        onDeliveryStatusChange={onDeliveryStatusChange}
        onManagerHealthWindowChange={onManagerHealthWindowChange}
        onManagerSourceChange={onManagerSourceChange}
        onManagerStatusChange={onManagerStatusChange}
        onPeriodChange={onPeriodChange}
        selectedDeliveryProvider={selectedDeliveryProvider}
        selectedDeliveryStatus={selectedDeliveryStatus}
        selectedManagerSource={selectedManagerSource}
        selectedManagerStatus={selectedManagerStatus}
        selectedPeriod={selectedPeriod}
        startDate={startDate}
      />
    </>
  );
}

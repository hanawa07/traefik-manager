import { clsx } from "clsx";
import { RotateCcw, Search } from "lucide-react";

import type { AuditManagerHealthSummary } from "@/features/audit/api/auditApi";

import {
  auditFilters,
  deliveryProviderOptions,
  deliveryStatusOptions,
  managerHealthWindowOptions,
  managerSourceOptions,
  managerStatusOptions,
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
  type ManagerSourceKey,
  type ManagerStatusKey,
} from "./auditPageHelpers";

interface AuditLogFiltersProps {
  selectedFilter: AuditFilterKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  managerHealthCounts?: AuditManagerHealthSummary;
  managerHealthWindowMinutes: ManagerHealthWindowMinutes;
  searchText: string;
  onFilterChange: (filter: AuditFilterKey) => void;
  onManagerSourceChange: (source: ManagerSourceKey) => void;
  onManagerStatusChange: (status: ManagerStatusKey) => void;
  onManagerHealthWindowChange: (minutes: ManagerHealthWindowMinutes) => void;
  onResetFilters: () => void;
  onSearchTextChange: (value: string) => void;
  onDeliveryStatusChange: (status: DeliveryStatusKey) => void;
  onDeliveryProviderChange: (provider: DeliveryProviderKey) => void;
}

export function AuditLogFilters({
  selectedFilter,
  selectedDeliveryStatus,
  selectedDeliveryProvider,
  selectedManagerSource,
  selectedManagerStatus,
  managerHealthCounts,
  managerHealthWindowMinutes,
  searchText,
  onFilterChange,
  onManagerSourceChange,
  onManagerStatusChange,
  onManagerHealthWindowChange,
  onResetFilters,
  onSearchTextChange,
  onDeliveryStatusChange,
  onDeliveryProviderChange,
}: AuditLogFiltersProps) {
  const activeConditions: string[] = [];
  if (searchText.trim()) activeConditions.push(`검색: ${searchText.trim()}`);
  if (selectedFilter !== "all") {
    activeConditions.push(auditFilters.find((filter) => filter.key === selectedFilter)?.label || "");
  }
  if (selectedManagerSource !== "all") {
    const label = managerSourceOptions.find((option) => option.key === selectedManagerSource)?.label;
    if (label) activeConditions.push(`소스: ${label}`);
  }
  if (selectedManagerStatus !== "all") {
    const label = managerStatusOptions.find((option) => option.key === selectedManagerStatus)?.label;
    if (label) activeConditions.push(`상태: ${label}`);
  }
  if (managerHealthWindowMinutes !== 10080) {
    const label = managerHealthWindowOptions.find(
      (option) => option.minutes === managerHealthWindowMinutes,
    )?.label;
    if (label) activeConditions.push(`집계: ${label}`);
  }
  if (selectedDeliveryStatus !== "all") {
    const label = deliveryStatusOptions.find((option) => option.key === selectedDeliveryStatus)?.label;
    if (label) activeConditions.push(label);
  }
  if (selectedDeliveryProvider !== "all") {
    const label = deliveryProviderOptions.find(
      (option) => option.key === selectedDeliveryProvider,
    )?.label;
    if (label) activeConditions.push(`채널: ${label}`);
  }

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {auditFilters.map((filter) => {
          const active = selectedFilter === filter.key;
          return (
            <button
              key={filter.key}
              aria-pressed={active}
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
            <span
              className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-200"
              key={condition}
            >
              {condition}
            </span>
          ))
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">Manager 소스</span>
          <select
            aria-label="Manager 소스"
            value={selectedManagerSource}
            onChange={(event) => onManagerSourceChange(event.target.value as ManagerSourceKey)}
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {managerSourceOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
                {getManagerCountLabel(
                  managerHealthCounts,
                  option.key,
                  selectedManagerStatus,
                )}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">Manager 상태</span>
          <select
            aria-label="Manager 상태"
            value={selectedManagerStatus}
            onChange={(event) => onManagerStatusChange(event.target.value as ManagerStatusKey)}
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {managerStatusOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
                {getManagerCountLabel(
                  managerHealthCounts,
                  selectedManagerSource,
                  option.key,
                )}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">Manager 집계 기간</span>
          <select
            aria-label="Manager 집계 기간"
            value={managerHealthWindowMinutes}
            onChange={(event) =>
              onManagerHealthWindowChange(
                Number(event.target.value) as ManagerHealthWindowMinutes,
              )
            }
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {managerHealthWindowOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">전송 상태</span>
          <select
            aria-label="전송 상태"
            value={selectedDeliveryStatus}
            onChange={(event) => onDeliveryStatusChange(event.target.value as DeliveryStatusKey)}
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {deliveryStatusOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">채널</span>
          <select
            aria-label="알림 채널"
            value={selectedDeliveryProvider}
            onChange={(event) => onDeliveryProviderChange(event.target.value as DeliveryProviderKey)}
            className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {deliveryProviderOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function getManagerCountLabel(
  counts: AuditManagerHealthSummary | undefined,
  source: ManagerSourceKey,
  status: ManagerStatusKey,
) {
  if (!counts) return "";
  const sourceCounts = {
    docker:
      status === "all"
        ? counts.docker_unhealthy_count + counts.docker_recovered_count
        : status === "unhealthy"
          ? counts.docker_unhealthy_count
          : counts.docker_recovered_count,
    watchdog:
      status === "all"
        ? counts.watchdog_unhealthy_count + counts.watchdog_recovered_count
        : status === "unhealthy"
          ? counts.watchdog_unhealthy_count
          : counts.watchdog_recovered_count,
  };
  const total =
    source === "all" ? sourceCounts.docker + sourceCounts.watchdog : sourceCounts[source];
  return ` (${total})`;
}

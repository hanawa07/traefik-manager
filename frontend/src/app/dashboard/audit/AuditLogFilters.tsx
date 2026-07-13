import { clsx } from "clsx";

import {
  auditFilters,
  deliveryProviderOptions,
  deliveryStatusOptions,
  managerHealthWindowOptions,
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
} from "./auditPageHelpers";

interface AuditLogFiltersProps {
  selectedFilter: AuditFilterKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedDeliveryProvider: DeliveryProviderKey;
  managerHealthCounts?: { unhealthy: number; recovered: number };
  managerHealthWindowMinutes: ManagerHealthWindowMinutes;
  onFilterChange: (filter: AuditFilterKey) => void;
  onManagerHealthWindowChange: (minutes: ManagerHealthWindowMinutes) => void;
  onDeliveryStatusChange: (status: DeliveryStatusKey) => void;
  onDeliveryProviderChange: (provider: DeliveryProviderKey) => void;
}

export function AuditLogFilters({
  selectedFilter,
  selectedDeliveryStatus,
  selectedDeliveryProvider,
  managerHealthCounts,
  managerHealthWindowMinutes,
  onFilterChange,
  onManagerHealthWindowChange,
  onDeliveryStatusChange,
  onDeliveryProviderChange,
}: AuditLogFiltersProps) {
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
              <span className="inline-flex items-center gap-1.5">
                {filter.label}
                {filter.key === "manager_unhealthy" && managerHealthCounts ? (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                    {managerHealthCounts.unhealthy}
                  </span>
                ) : null}
                {filter.key === "manager_recovered" && managerHealthCounts ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    {managerHealthCounts.recovered}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">Manager 집계 기간</span>
          <select
            aria-label="Manager 집계 기간"
            value={managerHealthWindowMinutes}
            onChange={(event) =>
              onManagerHealthWindowChange(
                Number(event.target.value) as ManagerHealthWindowMinutes,
              )
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {managerHealthWindowOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">전송 상태</span>
          <select
            value={selectedDeliveryStatus}
            onChange={(event) => onDeliveryStatusChange(event.target.value as DeliveryStatusKey)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {deliveryStatusOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none">
          <span className="text-slate-500 dark:text-slate-400">채널</span>
          <select
            value={selectedDeliveryProvider}
            onChange={(event) => onDeliveryProviderChange(event.target.value as DeliveryProviderKey)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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

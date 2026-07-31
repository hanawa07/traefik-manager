import type { AuditManagerHealthSummary } from "@/features/audit/api/auditApi";

import {
  deliveryProviderOptions,
  deliveryStatusOptions,
  managerHealthWindowOptions,
  managerSourceOptions,
  managerStatusOptions,
  type AuditPeriodDays,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
  type ManagerSourceKey,
  type ManagerStatusKey,
} from "./auditPageHelpers";
import { AuditLogDateRangeFields } from "./AuditLogDateRangeFields";

interface AuditLogAdvancedFiltersProps {
  endDate: string;
  managerHealthCounts?: AuditManagerHealthSummary;
  managerHealthWindowMinutes: ManagerHealthWindowMinutes;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onDeliveryProviderChange: (provider: DeliveryProviderKey) => void;
  onDeliveryStatusChange: (status: DeliveryStatusKey) => void;
  onManagerHealthWindowChange: (minutes: ManagerHealthWindowMinutes) => void;
  onManagerSourceChange: (source: ManagerSourceKey) => void;
  onManagerStatusChange: (status: ManagerStatusKey) => void;
  onPeriodChange: (period: AuditPeriodDays) => void;
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  selectedPeriod: AuditPeriodDays;
  startDate: string;
}

export function AuditLogAdvancedFilters({
  endDate,
  managerHealthCounts,
  managerHealthWindowMinutes,
  onDateRangeChange,
  onDeliveryProviderChange,
  onDeliveryStatusChange,
  onManagerHealthWindowChange,
  onManagerSourceChange,
  onManagerStatusChange,
  onPeriodChange,
  selectedDeliveryProvider,
  selectedDeliveryStatus,
  selectedManagerSource,
  selectedManagerStatus,
  selectedPeriod,
  startDate,
}: AuditLogAdvancedFiltersProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AuditLogDateRangeFields
        endDate={endDate}
        onDateRangeChange={onDateRangeChange}
        onPeriodChange={onPeriodChange}
        selectedPeriod={selectedPeriod}
        startDate={startDate}
      />
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
              {getManagerCountLabel(managerHealthCounts, option.key, selectedManagerStatus)}
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
              {getManagerCountLabel(managerHealthCounts, selectedManagerSource, option.key)}
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
            onManagerHealthWindowChange(Number(event.target.value) as ManagerHealthWindowMinutes)
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
    api:
      status === "all"
        ? counts.api_unhealthy_count + counts.api_recovered_count
        : status === "unhealthy"
          ? counts.api_unhealthy_count
          : counts.api_recovered_count,
    watchdog:
      status === "all"
        ? counts.watchdog_unhealthy_count + counts.watchdog_recovered_count
        : status === "unhealthy"
          ? counts.watchdog_unhealthy_count
          : counts.watchdog_recovered_count,
  };
  const total =
    source === "all"
      ? sourceCounts.docker + sourceCounts.api + sourceCounts.watchdog
      : sourceCounts[source];
  return ` (${total})`;
}

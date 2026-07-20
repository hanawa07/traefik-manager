"use client";

import Link from "next/link";
import { useState } from "react";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { useAuditPage } from "@/features/audit/hooks/useAudit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { parseAuditDate } from "./audit/auditPageHelpers";

interface MaintenanceScheduleHistoryPanelProps {
  serviceId: string;
  timezone?: string;
}

type MaintenanceHistoryPeriod = "all" | "7" | "30" | "90" | "custom";

interface MaintenanceHistoryFilters {
  actor: string;
  endDate: string;
  period: MaintenanceHistoryPeriod;
  startDate: string;
}

export function MaintenanceScheduleHistoryPanel({
  serviceId,
  timezone,
}: MaintenanceScheduleHistoryPanelProps) {
  const [filters, setFilters] = useState(readMaintenanceHistoryFilters);
  const { actor, endDate, period, startDate } = filters;
  const query = useAuditPage({
    limit: 100,
    offset: 0,
    resource_type: "service",
    action: "update",
    event: "service_update",
    period_days:
      period === "7" || period === "30" || period === "90"
        ? Number(period) as 7 | 30 | 90
        : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    search: serviceId,
  });
  const historyLogs = (query.data?.items ?? []).filter(
    (log) => log.resource_id === serviceId && hasMaintenanceUntilChange(log),
  );
  const actors = Array.from(new Set(historyLogs.map((log) => log.actor))).sort();
  const selectedActor = actor === "all" || actors.includes(actor) ? actor : "all";
  const logs = selectedActor === "all"
    ? historyLogs
    : historyLogs.filter((log) => log.actor === selectedActor);
  const updateFilters = (updates: Partial<MaintenanceHistoryFilters>) => {
    const next = { ...filters, ...updates };
    setFilters(next);
    replaceMaintenanceHistoryFilters(next);
  };
  const handlePeriodChange = (value: MaintenanceHistoryPeriod) => {
    updateFilters({ endDate: "", period: value, startDate: "" });
  };
  const handleStartDateChange = (value: string) => {
    const nextEndDate = value && endDate && value > endDate ? "" : endDate;
    updateFilters({
      endDate: nextEndDate,
      period: value || nextEndDate ? "custom" : "all",
      startDate: value,
    });
  };
  const handleEndDateChange = (value: string) => {
    const nextStartDate = value && startDate && value < startDate ? "" : startDate;
    updateFilters({
      endDate: value,
      period: value || nextStartDate ? "custom" : "all",
      startDate: nextStartDate,
    });
  };

  if (query.isLoading) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">변경 이력 확인 중...</p>;
  }
  return (
    <div className="grid gap-2">
      {!query.isError ? (
        <div className="flex flex-wrap justify-end gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            시작
            <input
              aria-label="점검 변경 이력 시작일"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              max={endDate || undefined}
              type="date"
              value={startDate}
              onChange={(event) => handleStartDateChange(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            종료
            <input
              aria-label="점검 변경 이력 종료일"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              min={startDate || undefined}
              type="date"
              value={endDate}
              onChange={(event) => handleEndDateChange(event.target.value)}
            />
          </label>
          <select
            aria-label="점검 변경 이력 기간"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={period}
            onChange={(event) => handlePeriodChange(event.target.value as MaintenanceHistoryPeriod)}
          >
            <option value="all">전체 기간</option>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="90">최근 90일</option>
            <option disabled value="custom">직접 지정</option>
          </select>
          <select
            aria-label="점검 변경 이력 변경자"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            disabled={!actors.length}
            value={selectedActor}
            onChange={(event) => updateFilters({ actor: event.target.value })}
          >
            <option value="all">모든 변경자</option>
            {actors.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      ) : null}
      {query.isError ? (
        <p className="text-xs text-rose-700 dark:text-rose-300">변경 이력을 불러오지 못했습니다.</p>
      ) : logs.length ? (
        <ol
          className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
          data-maintenance-history-count={logs.length}
          data-maintenance-history-actor={selectedActor}
          data-maintenance-history-end-date={endDate}
          data-maintenance-history-period={period}
          data-maintenance-history-start-date={startDate}
          data-testid="maintenance-schedule-history"
        >
          {logs.map((log) => {
            const before = getMaintenanceUntil(log, "before");
            const after = getMaintenanceUntil(log, "after");
            return (
              <li
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                data-maintenance-history-after={after ?? "unset"}
                data-maintenance-history-before={before ?? "unset"}
                key={log.id}
              >
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatMaintenanceUntil(before, timezone)} → {formatMaintenanceUntil(after, timezone)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {log.actor} · {formatDateTime(log.created_at, timezone)}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">기록된 종료 시각 변경이 없습니다.</p>
      )}
      <Link
        className="justify-self-end text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
        data-testid="maintenance-history-audit-link"
        href={`/dashboard/audit?q=${encodeURIComponent(serviceId)}`}
      >
        해당 서비스 감사 로그 전체 보기
      </Link>
    </div>
  );
}

function hasMaintenanceUntilChange(log: AuditLogItem) {
  const changedKeys = log.detail?.changed_keys;
  return Array.isArray(changedKeys) && changedKeys.includes("maintenance_until");
}

function getMaintenanceUntil(log: AuditLogItem, key: "after" | "before") {
  const snapshot = log.detail?.[key];
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).maintenance_until;
  return typeof value === "string" ? value : null;
}

function formatMaintenanceUntil(value: string | null, timezone?: string) {
  return value ? formatDateTime(value, timezone) : "미설정";
}

function readMaintenanceHistoryFilters(): MaintenanceHistoryFilters {
  if (typeof window === "undefined") {
    return { actor: "all", endDate: "", period: "all", startDate: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const startDate = parseAuditDate(params.get("maintenance_history_start"));
  const parsedEndDate = parseAuditDate(params.get("maintenance_history_end"));
  const endDate = startDate && parsedEndDate && startDate > parsedEndDate ? "" : parsedEndDate;
  const actor = (params.get("maintenance_history_actor") || "all").slice(0, 100);
  return {
    actor: actor || "all",
    endDate,
    period: startDate || endDate
      ? "custom"
      : parseMaintenanceHistoryPeriod(params.get("maintenance_history_period")),
    startDate,
  };
}

function parseMaintenanceHistoryPeriod(value: string | null): MaintenanceHistoryPeriod {
  return value === "7" || value === "30" || value === "90" ? value : "all";
}

function replaceMaintenanceHistoryFilters(filters: MaintenanceHistoryFilters) {
  const url = new URL(window.location.href);
  const values: [key: string, value: string, defaultValue: string][] = [
    ["maintenance_history_actor", filters.actor, "all"],
    ["maintenance_history_period", filters.period, "all"],
    ["maintenance_history_start", filters.startDate, ""],
    ["maintenance_history_end", filters.endDate, ""],
  ];
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  });
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

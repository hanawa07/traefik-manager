"use client";

import Link from "next/link";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { useAuditPage } from "@/features/audit/hooks/useAudit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface MaintenanceScheduleHistoryPanelProps {
  serviceId: string;
  timezone?: string;
}

export function MaintenanceScheduleHistoryPanel({
  serviceId,
  timezone,
}: MaintenanceScheduleHistoryPanelProps) {
  const query = useAuditPage({
    limit: 20,
    offset: 0,
    resource_type: "service",
    action: "update",
    event: "service_update",
    search: serviceId,
  });
  const logs = (query.data?.items ?? []).filter(
    (log) => log.resource_id === serviceId && hasMaintenanceUntilChange(log),
  );

  if (query.isLoading) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">변경 이력 확인 중...</p>;
  }
  return (
    <div className="grid gap-2">
      {query.isError ? (
        <p className="text-xs text-rose-700 dark:text-rose-300">변경 이력을 불러오지 못했습니다.</p>
      ) : logs.length ? (
        <ol
          className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
          data-maintenance-history-count={logs.length}
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

import { Activity, ExternalLink } from "lucide-react";
import Link from "next/link";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHealthHistoryCardProps {
  logs: AuditLogItem[];
  isError: boolean;
  isLoading: boolean;
  timezone?: string;
}

export function ManagerHealthHistoryCard({
  logs,
  isError,
  isLoading,
  timezone,
}: ManagerHealthHistoryCardProps) {
  return (
    <section className="card mb-4 p-4 sm:mb-6 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Docker 상태 전이 이력
            </h2>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Manager Backend·Frontend에서 감지한 최근 이상과 복구 기록입니다.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          href="/dashboard/audit?filter=manager_health"
        >
          Manager 이력만 보기
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? <HistoryNotice text="상태 전이 이력을 불러오는 중입니다" /> : null}
        {isError ? <HistoryNotice error text="상태 전이 이력을 불러오지 못했습니다" /> : null}
        {!isLoading && !isError && logs.length === 0 ? (
          <HistoryNotice text="아직 기록된 Docker 이상·복구 전이가 없습니다" />
        ) : null}
        {!isLoading && !isError
          ? logs.map((log) => (
              <ManagerHealthHistoryRow key={log.id} log={log} timezone={timezone} />
            ))
          : null}
      </div>
    </section>
  );
}

function ManagerHealthHistoryRow({ log, timezone }: { log: AuditLogItem; timezone?: string }) {
  const event = getDetailString(log, "event") ?? log.event;
  const isRecovery = event === "manager_docker_recovered";
  const component = getComponentLabel(log.resource_name || log.resource_id);
  const failingStreak = getDetailNumber(log, "failing_streak");
  const exitCode = getDetailNumber(log, "last_exit_code");

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-950">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              isRecovery ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
            {component} {isRecovery ? "Docker 복구" : "Docker 이상"}
          </p>
        </div>
        {!isRecovery ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            연속 실패 {failingStreak ?? "-"}회 · 종료 코드 {exitCode ?? "-"}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">
        {formatDateTime(log.created_at, timezone)}
      </span>
    </div>
  );
}

function HistoryNotice({ error = false, text }: { error?: boolean; text: string }) {
  return (
    <p
      className={`rounded-xl border px-3 py-3 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
      }`}
    >
      {text}
    </p>
  );
}

function getDetailString(log: AuditLogItem, key: string) {
  const value = log.detail?.[key];
  return typeof value === "string" ? value : null;
}

function getDetailNumber(log: AuditLogItem, key: string) {
  const value = log.detail?.[key];
  return typeof value === "number" ? value : null;
}

function getComponentLabel(name: string) {
  if (name === "backend") return "Backend";
  if (name === "frontend") return "Frontend";
  return name;
}

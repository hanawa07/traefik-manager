import { CheckCircle2, RotateCcw } from "lucide-react";

import type { TraefikUpdateOperations } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { TraefikUpdateAlertRun } from "./TraefikUpdateAlertRun";

type TraefikUpdateHistoryEntry = TraefikUpdateOperations["history"][number];

interface TraefikUpdateHistoryItemProps {
  canManage: boolean;
  entry: TraefikUpdateHistoryEntry;
  pendingRequest: boolean;
  runnerAvailable: boolean;
  timezone?: string;
}

export function TraefikUpdateHistoryItem({
  canManage,
  entry,
  pendingRequest,
  runnerAvailable,
  timezone,
}: TraefikUpdateHistoryItemProps) {
  const successfulChecks = entry.validations.filter((check) => check.status === "ok").length;

  return (
    <li
      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-900"
      data-traefik-update-request-id={entry.request_id}
      data-traefik-update-status={entry.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 font-bold ${getStatusClassName(entry.status)}`}>
          {getStatusLabel(entry.status)}
        </span>
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
          {entry.from_version} → {entry.target_version}
        </span>
        <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
          {entry.actor} · {formatDateTime(entry.completed_at || entry.started_at, timezone)}
        </span>
      </div>
      <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">{entry.message}</p>
      {entry.backup_dir ? (
        <p
          className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400"
          title={entry.backup_dir}
        >
          백업: {entry.backup_dir}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
        {entry.backup_created ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> 백업 생성
          </span>
        ) : null}
        {entry.validations.length ? (
          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
            <CheckCircle2 className="h-3 w-3" />
            검증 {successfulChecks}/{entry.validations.length}
          </span>
        ) : null}
        {entry.rollback_performed ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <RotateCcw className="h-3 w-3" /> 자동 롤백 수행
          </span>
        ) : null}
      </div>
      <TraefikUpdateAlertRun
        canManage={canManage}
        entry={entry}
        pendingRequest={pendingRequest}
        runnerAvailable={runnerAvailable}
        timezone={timezone}
      />
      {entry.validations.length ? (
        <details className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer font-semibold">검증 상세</summary>
          <ul className="mt-1 grid gap-1">
            {entry.validations.map((check) => (
              <li key={check.key}>
                {check.status === "ok" ? "정상" : "실패"} · {check.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function getStatusLabel(status: TraefikUpdateHistoryEntry["status"]) {
  if (status === "success") return "완료";
  if (status === "running") return "처리 중";
  if (status === "rejected") return "요청 거부";
  if (status === "rolled_back") return "자동 롤백";
  return "롤백 실패";
}

function getStatusClassName(status: TraefikUpdateHistoryEntry["status"]) {
  if (status === "success") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }
  if (status === "running") {
    return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200";
  }
  if (status === "rolled_back") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}

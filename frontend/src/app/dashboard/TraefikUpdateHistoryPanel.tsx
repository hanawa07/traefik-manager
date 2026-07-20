import { CheckCircle2, Clock3, RotateCcw, ServerCog } from "lucide-react";

import type { TraefikUpdateOperations } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikUpdateHistoryPanelProps {
  isError: boolean;
  isLoading: boolean;
  operations?: TraefikUpdateOperations;
  timezone?: string;
}

export function TraefikUpdateHistoryPanel({
  isError,
  isLoading,
  operations,
  timezone,
}: TraefikUpdateHistoryPanelProps) {
  const history = operations?.history ?? [];
  return (
    <div
      className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/55"
      data-traefik-update-runner={operations?.runner.status || "loading"}
      data-testid="traefik-update-operations"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ServerCog className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            Traefik 호스트 업데이트 이력
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            백업, 런타임 검증, 자동 롤백 결과를 요청별로 보관합니다.
          </p>
        </div>
        <RunnerBadge operations={operations} />
      </div>

      {operations?.pending_request ? (
        <p className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
          호스트 실행기가 업데이트 요청을 처리하고 있습니다.
        </p>
      ) : null}
      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">업데이트 이력 확인 중...</p>
      ) : isError ? (
        <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
          호스트 업데이트 이력을 불러오지 못했습니다.
        </p>
      ) : history.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Manager에서 요청한 업데이트 이력이 아직 없습니다.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2" data-testid="traefik-update-history">
          {history.slice(0, 5).map((entry) => {
            const successfulChecks = entry.validations.filter((check) => check.status === "ok").length;
            return (
              <li
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                data-traefik-update-status={entry.status}
                key={entry.request_id}
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
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400" title={entry.backup_dir}>
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
                      <CheckCircle2 className="h-3 w-3" /> 검증 {successfulChecks}/{entry.validations.length}
                    </span>
                  ) : null}
                  {entry.rollback_performed ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      <RotateCcw className="h-3 w-3" /> 자동 롤백 수행
                    </span>
                  ) : null}
                </div>
                {entry.validations.length ? (
                  <details className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer font-semibold">검증 상세</summary>
                    <ul className="mt-1 grid gap-1">
                      {entry.validations.map((check) => (
                        <li key={check.key}>{check.status === "ok" ? "정상" : "실패"} · {check.message}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function RunnerBadge({ operations }: { operations?: TraefikUpdateOperations }) {
  const runner = operations?.runner;
  const isAvailable = runner?.available === true;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isAvailable
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
      title={runner?.message}
    >
      {isAvailable ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {isAvailable ? "호스트 실행기 준비됨" : "호스트 실행기 확인 필요"}
    </span>
  );
}

function getStatusLabel(status: TraefikUpdateOperations["history"][number]["status"]) {
  if (status === "success") return "완료";
  if (status === "running") return "처리 중";
  if (status === "rejected") return "요청 거부";
  if (status === "rolled_back") return "자동 롤백";
  return "롤백 실패";
}

function getStatusClassName(status: TraefikUpdateOperations["history"][number]["status"]) {
  if (status === "success") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (status === "running") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200";
  if (status === "rolled_back") return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}

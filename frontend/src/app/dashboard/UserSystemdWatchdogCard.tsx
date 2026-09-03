import { CircleCheck, TriangleAlert } from "lucide-react";

import type { UserSystemdWatchdog } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { formatUserSystemdIssue } from "./userSystemdWatchdogPresentation";

interface UserSystemdWatchdogCardProps {
  state?: UserSystemdWatchdog;
  timezone?: string;
}

function getStatusView(state?: UserSystemdWatchdog) {
  if (state?.status === "unhealthy") {
    return {
      label: "이상 감지",
      tone: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
    };
  }
  if (state?.stale) {
    return {
      label: "점검 지연",
      tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state?.status === "healthy") {
    return {
      label: "정상",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
    };
  }
  return {
    label: "상태 없음",
    tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
  };
}

export function UserSystemdWatchdogCard({ state, timezone }: UserSystemdWatchdogCardProps) {
  const view = getStatusView(state);
  const Icon = state?.status === "unhealthy" || state?.stale ? TriangleAlert : CircleCheck;

  return (
    <section
      className={`mt-4 rounded-xl border px-4 py-3 text-xs ${view.tone}`}
      data-stale={state?.stale ? "true" : "false"}
      data-status={state?.status ?? "unknown"}
      data-testid="user-systemd-watchdog"
      data-unit-count={state?.monitored_unit_count ?? 0}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" />
          사용자 systemd 실행 감시
        </p>
        <span className="rounded-full border border-current/20 px-2 py-0.5 font-semibold">
          {view.label}
        </span>
      </div>
      <p className="mt-2">
        마지막 점검: {formatDateTime(state?.checked_at, timezone)}
        {state?.stale ? ` · ${state.stale_after_minutes}분 이상 갱신 없음` : ""}
      </p>
      <p className="mt-1">
        감시 대상: {state?.monitored_unit_count ? `${state.monitored_unit_count}개 unit` : "-"} ·
        연속 감지 {state?.consecutive_failures ?? 0}회
        {state?.alert_active ? " · 운영 알림 활성" : ""}
      </p>
      {state?.issues.length ? (
        <div className="mt-3 border-t border-current/15 pt-2">
          <p className="font-semibold">최근 원인</p>
          <ul className="mt-1 space-y-1">
            {state.issues.slice(0, 5).map((issue) => (
              <li className="break-all" key={`${issue.code}-${issue.unit ?? "global"}`}>
                {formatUserSystemdIssue(issue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

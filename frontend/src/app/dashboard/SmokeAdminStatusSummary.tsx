import Link from "next/link";
import { MonitorCheck } from "lucide-react";

import type { SmokeRotationStatus } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SmokeAdminStatusSummaryProps {
  isError: boolean;
  isLoading: boolean;
  status?: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeAdminStatusSummary({
  isError,
  isLoading,
  status,
  timezone,
}: SmokeAdminStatusSummaryProps) {
  const summary = getSummary(isError, isLoading, status, timezone);

  return (
    <section
      className={`mb-4 flex flex-col gap-2 rounded-lg border px-4 py-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between ${summary.tone}`}
      data-smoke-admin-status={summary.key}
      data-testid="smoke-admin-status-summary"
    >
      <div className="flex min-w-0 items-start gap-3">
        <MonitorCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">관리자 운영 점검</p>
          <p className="mt-1 text-xs">{summary.detail}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold dark:bg-slate-950/60">
          {summary.label}
        </span>
        <Link className="text-xs font-semibold underline underline-offset-2" href="/dashboard/settings">
          설정에서 확인
        </Link>
      </div>
    </section>
  );
}

function getSummary(
  isError: boolean,
  isLoading: boolean,
  status: SmokeRotationStatus | undefined,
  timezone: string | undefined,
) {
  if (isLoading) return summary("pending", "확인 중", "최근 성공 기록을 확인하는 중입니다.");
  if (isError || !status) return summary("error", "확인 실패", "관리자 점검 상태를 불러오지 못했습니다.");
  if (!status.monitoring_enabled) return summary("disabled", "예약 중지", "예약 자동 점검이 중지되어 있습니다.");
  if (!status.monitoring_admin_last_success_at) return summary("missing", "기록 없음", "관리자 전용 점검 성공 기록이 없습니다.");
  const detail = `최근 성공 ${formatDateTime(status.monitoring_admin_last_success_at, timezone)} · ${status.monitoring_admin_stale_after_days}일 초과 시 경고`;
  if (status.monitoring_admin_is_stale) return summary("stale", "점검 지연", detail);
  return summary("fresh", "정상", detail);
}

function summary(key: string, label: string, detail: string) {
  const warning = key === "stale" || key === "error" || key === "missing";
  return {
    detail,
    key,
    label,
    tone: warning
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
      : "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100",
  };
}

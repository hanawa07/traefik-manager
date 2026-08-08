import Link from "next/link";
import { MonitorCheck } from "lucide-react";

import type { SmokeRotationStatus } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { SmokeDeploymentRevisionStatus } from "./SmokeDeploymentRevisionStatus";
import { SmokeRunTrend } from "./SmokeRunTrend";

interface SmokeAdminStatusSummaryProps {
  canViewHistory: boolean;
  deployedRevision?: string | null;
  historyRefreshRetryAt: string | null;
  isError: boolean;
  isHistoryRefreshBlocked: boolean;
  isLoading: boolean;
  isRefreshingHistory: boolean;
  onRefreshHistory: () => void;
  refreshHistoryError: string | null;
  status?: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeAdminStatusSummary({
  canViewHistory,
  deployedRevision,
  historyRefreshRetryAt,
  isError,
  isHistoryRefreshBlocked,
  isLoading,
  isRefreshingHistory,
  onRefreshHistory,
  refreshHistoryError,
  status,
  timezone,
}: SmokeAdminStatusSummaryProps) {
  const summary = getSummary(isError, isLoading, status, timezone);
  const isLocalMode = status?.monitoring_mode === "local";

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
          {status ? (
            isLocalMode ? (
              <>
                <SmokeDeploymentRevisionStatus
                  deployedRevision={deployedRevision}
                  localCheckedAt={status.last_success_at}
                  localRevision={status.last_revision}
                  mode="local"
                  runs={[]}
                  timezone={timezone}
                />
                <div
                  className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
                  data-smoke-history-access="local"
                  data-testid="smoke-run-trend"
                >
                  <span className="font-semibold">운영 점검 추이</span>
                  <span>Tailnet 호스트의 월간 로컬 점검을 사용합니다.</span>
                  <span>
                    전환 전 GitHub 실행 통계와 로컬 콜백 이력은 관리자 계정에서 확인합니다.
                  </span>
                </div>
              </>
            ) : canViewHistory ? (
              <>
                <SmokeDeploymentRevisionStatus
                  deployedRevision={deployedRevision}
                  runs={status.monitoring_recent_runs}
                />
                <SmokeRunTrend
                  dataCheckedAt={status.monitoring_history_data_checked_at}
                  error={status.monitoring_history_error}
                  failureRateMinRuns={status.monitoring_failure_rate_min_runs}
                  failureRateThresholdPercent={status.monitoring_failure_rate_threshold_percent}
                  failureRateWindowDays={status.monitoring_failure_rate_window_days}
                  historyRefreshRetryAt={historyRefreshRetryAt}
                  isHistoryRefreshBlocked={isHistoryRefreshBlocked}
                  localRuns={status.monitoring_local_runs ?? []}
                  localRunLimit={status.monitoring_local_run_limit ?? 20}
                  localRunRetentionDays={status.monitoring_local_run_retention_days ?? 365}
                  localRunTotal={status.monitoring_local_run_total ?? 0}
                  isRefreshingHistory={isRefreshingHistory}
                  onRefreshHistory={onRefreshHistory}
                  refreshHistoryError={refreshHistoryError}
                  runs={status.monitoring_recent_runs}
                  statistics={status.monitoring_run_statistics ?? []}
                  statisticsSnapshots={status.monitoring_statistics_snapshots ?? []}
                  timezone={timezone}
                  workflowUrl={status.monitoring_workflow_url}
                />
              </>
            ) : (
              <>
                <p
                  className="mt-1 w-fit rounded bg-white/70 px-2 py-1 font-semibold text-cyan-900 dark:bg-slate-950/60 dark:text-cyan-100"
                  data-smoke-revision-status="restricted"
                  data-testid="smoke-deployment-revision-status"
                >
                  운영 스모크 커밋 · 관리자 계정에서 확인
                </p>
                <div
                  className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
                  data-smoke-history-access="restricted"
                  data-testid="smoke-run-trend"
                >
                  <span className="font-semibold">운영 점검 추이</span>
                  <span>GitHub 실행 통계와 로컬 콜백 이력은 관리자 계정에서 확인합니다.</span>
                </div>
              </>
            )
          ) : null}
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
  if (status.monitoring_mode === "local") {
    if (status.status === "running") return summary("pending", "점검 중", "Tailnet 로컬 점검을 실행하는 중입니다.");
    if (status.status === "failure") return summary("error", "로컬 실패", `Tailnet 로컬 점검 실패 · ${status.detail || "실패 단계를 확인하세요."}`);
    if (!status.last_success_at) return summary("missing", "기록 없음", "Tailnet 로컬 점검 성공 기록이 없습니다.");
    const detail = `Tailnet 로컬 점검 최근 성공 ${formatDateTime(status.last_success_at, timezone)} · ${status.stale_after_days}일 초과 시 경고`;
    if (status.is_stale) return summary("stale", "점검 지연", detail);
    return summary("fresh", "로컬 정상", detail);
  }
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

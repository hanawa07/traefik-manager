"use client";

import { useEffect, useState } from "react";

import type {
  SmokeMonitoringRecentRun,
  SmokeLocalRun,
  SmokeRunStatistics,
  SmokeStatisticsSnapshot,
} from "@/features/settings/api/settingsApi";
import { formatDurationSeconds } from "@/shared/lib/formatDurationSeconds";
import {
  getCompletedSmokeRunsInWindow,
  getSmokeFailureRateFromCounts,
  getSmokeRunFailureRate,
} from "./smokeRunFailureRate";
import {
  getSmokeRunTooltip,
  SmokeFailureArtifactLinks,
} from "./SmokeFailureArtifactLinks";
import { SmokeDurationTrend } from "./SmokeDurationTrend";
import { SmokeRunStatisticsHistory } from "./SmokeRunStatisticsHistory";

const STATUS_STYLES = {
  failure: "bg-rose-500 hover:bg-rose-600",
  skipped: "bg-slate-400 hover:bg-slate-500",
  success: "bg-emerald-500 hover:bg-emerald-600",
  cancelled: "bg-amber-500 hover:bg-amber-600",
} as const;

const ARTIFACT_CLOCK_INTERVAL_MS = 60_000;
const STATUS_LABELS = {
  failure: "실패",
  skipped: "건너뜀",
  success: "성공",
  cancelled: "취소",
} as const;

interface SmokeRunTrendProps {
  error: string | null;
  failureRateMinRuns: number;
  failureRateThresholdPercent: number;
  failureRateWindowDays: 7 | 30;
  runs: SmokeMonitoringRecentRun[];
  localRuns: SmokeLocalRun[];
  localRunLimit: number;
  localRunRetentionDays: number;
  localRunTotal: number;
  statistics: SmokeRunStatistics[];
  statisticsSnapshots: SmokeStatisticsSnapshot[];
  timezone?: string;
  workflowUrl: string;
}

export function SmokeRunTrend({
  error,
  failureRateMinRuns,
  failureRateThresholdPercent,
  failureRateWindowDays,
  localRuns,
  localRunLimit,
  localRunRetentionDays,
  localRunTotal,
  runs,
  statistics,
  statisticsSnapshots,
  timezone,
  workflowUrl,
}: SmokeRunTrendProps) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  useEffect(() => {
    const refreshClock = () => setPeriodReferenceTime(Date.now());
    const intervalId = window.setInterval(refreshClock, ARTIFACT_CLOCK_INTERVAL_MS);
    window.addEventListener("focus", refreshClock);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshClock);
    };
  }, []);
  const cutoff = periodReferenceTime - rangeDays * 24 * 60 * 60 * 1000;
  const recent = runs
    .filter((run) => Date.parse(run.completed_at) >= cutoff)
    .reverse();
  const statistic = statistics.find((item) => item.window_days === rangeDays);
  const slowestRuns = statistic?.slowest_runs ?? [];
  const failureRateStatistic = statistics.find(
    (item) => item.window_days === failureRateWindowDays,
  );
  const successCount =
    statistic?.success_count ?? recent.filter((run) => run.status === "success").length;
  const failureCount =
    statistic?.failure_count ?? recent.filter((run) => run.status === "failure").length;
  const cancelledCount =
    statistic?.cancelled_count ?? recent.filter((run) => run.status === "cancelled").length;
  const skippedCount =
    statistic?.skipped_count ?? recent.filter((run) => run.status === "skipped").length;
  const totalCount = statistic?.total_count ?? recent.length;
  const failureRate = failureRateStatistic
    ? getSmokeFailureRateFromCounts(
        failureRateStatistic.success_count,
        failureRateStatistic.failure_count,
        failureRateThresholdPercent,
        failureRateMinRuns,
      )
    : getSmokeRunFailureRate(
        runs,
        periodReferenceTime,
        failureRateThresholdPercent,
        failureRateMinRuns,
        failureRateWindowDays,
      );
  const failedRuns = getCompletedSmokeRunsInWindow(
    runs,
    periodReferenceTime,
    failureRateWindowDays,
  ).filter((run) => run.status === "failure");
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
      data-artifact-reference-time={periodReferenceTime}
      data-testid="smoke-run-trend"
    >
      <span className="font-semibold">운영 점검 추이</span>
      <div className="inline-flex rounded-md border border-current/20 p-0.5" aria-label="운영 점검 범위">
        {([7, 30] as const).map((days) => (
          <button
            key={days}
            type="button"
            className={`rounded px-1.5 py-0.5 font-semibold ${rangeDays === days ? "bg-white/80 shadow-sm dark:bg-slate-950/70" : "opacity-60"}`}
            aria-pressed={rangeDays === days}
            onClick={() => setRangeDays(days)}
          >
            {days}일
          </button>
        ))}
      </div>
      {recent.length ? (
        <div
          className="flex max-w-56 flex-wrap items-center gap-1"
          aria-label={`최근 ${rangeDays}일 실행 링크 ${recent.length}건`}
        >
          {recent.map((run) => {
            const tooltip = getSmokeRunTooltip(run, timezone);
            return (
              <a
                key={run.run_url}
                className={`h-2.5 w-3 rounded-sm transition-colors ${STATUS_STYLES[run.status]}`}
                href={run.run_url}
                target="_blank"
                rel="noreferrer"
                title={tooltip}
              >
                <span className="sr-only">{tooltip}</span>
              </a>
            );
          })}
        </div>
      ) : (
        <span className="opacity-80">{error ? "확인 실패" : "이력 없음"}</span>
      )}
      <span data-testid="smoke-run-status-counts">
        {rangeDays}일 전체 {totalCount}건 · 성공 {successCount} · 실패 {failureCount} · 취소 {cancelledCount} · 건너뜀 {skippedCount}
      </span>
      <span className="opacity-80">표시 링크 {recent.length}건</span>
      <span className="opacity-80" data-testid="smoke-failure-rate-basis">
        실패율 분모: workflow 성공+실패 · 취소·전체 건너뜀 제외
      </span>
      <span
        className={
          failureRate.isAlert
            ? "rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            : "opacity-80"
        }
        data-testid="smoke-failure-rate"
        role={failureRate.isAlert ? "alert" : undefined}
      >
        {failureRate.totalCount === 0
          ? `${failureRateWindowDays}일 실패율 이력 없음 · 경고 ${failureRateThresholdPercent}%`
          : failureRate.totalCount < failureRateMinRuns
            ? `${failureRateWindowDays}일 실패율 ${failureRate.percentage}% (${failureRate.failureCount}/${failureRate.totalCount}) · ${failureRateMinRuns}회부터 판정`
            : `${failureRate.isAlert ? "실패율 경고" : `${failureRateWindowDays}일 실패율`} ${failureRate.percentage}% (${failureRate.failureCount}/${failureRate.totalCount}) · 기준 ${failureRateThresholdPercent}%`}
      </span>
      <span className="opacity-80" data-testid="smoke-actions-usage">
        {statistic
          ? `Actions 실행시간 ${statistic.duration_run_count}/${statistic.total_count}건 총 ${formatDurationSeconds(statistic.total_duration_seconds)} · 평균 ${formatDurationSeconds(statistic.average_duration_seconds)} · 예상 사용량 ${statistic.estimated_runner_minutes} runner분`
          : "Actions 실행시간·예상 사용량 집계 없음"}
      </span>
      <span className="opacity-70" data-testid="smoke-actions-usage-note">
        GitHub workflow 결론·벽시계 기준 추정 · 내부 단계 건너뜀은 성공에 포함될 수 있음 ·
        GitHub 과금값 아님
      </span>
      <SmokeDurationTrend
        localRuns={localRuns}
        statistics={statistics}
        workflowUrl={workflowUrl}
      />
      {statistic ? (
        <details
          className="basis-full rounded-md border border-current/15 bg-white/40 px-2.5 py-2 dark:bg-slate-950/30"
          data-testid="smoke-actions-usage-details"
        >
          <summary className="cursor-pointer font-semibold">
            느린 실행 상위 {slowestRuns.length}건 · 집계 기준 도움말
          </summary>
          <p className="mt-2 opacity-80">
            workflow 결론은 실행 전체 결과입니다. 내부 단계가 skipped여도 다른 단계가 성공하면 workflow는
            성공으로 기록될 수 있습니다. 정확한 단계별 건너뜀 집계에는 실행마다 jobs API 조회가 필요하므로,
            현재 통계는 추가 호출 없이 workflow 결론만 사용합니다.
          </p>
          {slowestRuns.length ? (
            <ol className="mt-2 flex flex-wrap gap-1.5" data-testid="smoke-slowest-runs">
              {slowestRuns.map((run) => (
                <li key={run.run_id}>
                  <a
                    className="inline-flex items-center gap-1 rounded-full border border-current/20 px-2 py-1 font-semibold hover:bg-white/70 dark:hover:bg-slate-900/70"
                    href={run.run_url}
                    rel="noreferrer"
                    target="_blank"
                    title={`${run.completed_at} · ${STATUS_LABELS[run.status]}`}
                  >
                    #{run.run_number ?? run.run_id} · {formatDurationSeconds(run.duration_seconds)}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </details>
      ) : null}
      <SmokeRunStatisticsHistory
        localRuns={localRuns}
        localRunLimit={localRunLimit}
        localRunRetentionDays={localRunRetentionDays}
        localRunTotal={localRunTotal}
        snapshots={statisticsSnapshots}
        timezone={timezone}
        workflowUrl={workflowUrl}
      />
      <SmokeFailureArtifactLinks
        failedRuns={failedRuns}
        periodReferenceTime={periodReferenceTime}
        timezone={timezone}
        visible={failureRate.isAlert && failedRuns.length > 0}
      />
    </div>
  );
}

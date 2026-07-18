"use client";

import { useState } from "react";

import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  getCompletedSmokeRunsInWindow,
  getSmokeRunFailureRate,
} from "./smokeRunFailureRate";

const STATUS_LABELS = {
  failure: "실패",
  skipped: "건너뜀",
  success: "성공",
} as const;

const STATUS_STYLES = {
  failure: "bg-rose-500 hover:bg-rose-600",
  skipped: "bg-slate-400 hover:bg-slate-500",
  success: "bg-emerald-500 hover:bg-emerald-600",
} as const;

interface SmokeRunTrendProps {
  error: string | null;
  failureRateMinRuns: number;
  failureRateThresholdPercent: number;
  failureRateWindowDays: 7 | 30;
  runs: SmokeMonitoringRecentRun[];
  timezone?: string;
}

export function SmokeRunTrend({
  error,
  failureRateMinRuns,
  failureRateThresholdPercent,
  failureRateWindowDays,
  runs,
  timezone,
}: SmokeRunTrendProps) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [periodReferenceTime] = useState(() => Date.now());
  const cutoff = periodReferenceTime - rangeDays * 24 * 60 * 60 * 1000;
  const recent = runs
    .filter((run) => Date.parse(run.completed_at) >= cutoff)
    .reverse();
  const successCount = recent.filter((run) => run.status === "success").length;
  const failureRate = getSmokeRunFailureRate(
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
  const displayedFailedRuns = failedRuns.slice(0, 5);
  const artifactCount = displayedFailedRuns.filter((run) => run.artifact_url).length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" data-testid="smoke-run-trend">
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
        <>
          <div
            className="flex max-w-56 flex-wrap items-center gap-1"
            aria-label={`최근 ${rangeDays}일 ${recent.length}회 중 ${successCount}회 성공`}
          >
            {recent.map((run) => {
              const tooltip = getRunTooltip(run, timezone);
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
          <span>{successCount}/{recent.length} 성공</span>
        </>
      ) : (
        <span className="opacity-80">{error ? "확인 실패" : "이력 없음"}</span>
      )}
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
      {failureRate.isAlert && failedRuns.length ? (
        <span
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-rose-200 bg-white/70 px-2 py-0.5 dark:border-rose-500/30 dark:bg-slate-950/50"
          data-artifact-count={artifactCount}
          data-testid="smoke-failure-run-links"
        >
          <span className="font-semibold">실패 실행</span>
          {displayedFailedRuns.map((run, index) => {
            const runLabel = run.run_number ? `#${run.run_number}` : `${index + 1}번`;
            return (
              <span key={run.run_url} className="inline-flex items-center gap-1">
                <a
                  className="font-semibold text-rose-700 underline underline-offset-2 dark:text-rose-300"
                  href={run.run_url}
                  target="_blank"
                  rel="noreferrer"
                  title={getRunTooltip(run, timezone)}
                >
                  {runLabel}
                </a>
                {run.artifact_url ? (
                  <a
                    aria-label={`${runLabel} 실패 화면 Artifact`}
                    className="font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
                    data-testid="smoke-failure-artifact-link"
                    href={run.artifact_url}
                    target="_blank"
                    rel="noreferrer"
                    title="GitHub 로그인 후 실패 화면 ZIP 다운로드"
                  >
                    화면
                  </a>
                ) : null}
              </span>
            );
          })}
          {failedRuns.length > 5 ? <span>외 {failedRuns.length - 5}건</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function getRunTooltip(run: SmokeMonitoringRecentRun, timezone?: string) {
  return [
    run.run_number ? `#${run.run_number}` : "실행",
    STATUS_LABELS[run.status],
    formatDateTime(run.completed_at, timezone),
    run.summary,
  ].filter(Boolean).join(" · ");
}

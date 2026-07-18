"use client";

import { useEffect, useState } from "react";

import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  getCompletedSmokeRunsInWindow,
  getSmokeRunFailureRate,
} from "./smokeRunFailureRate";
import {
  filterAndPrioritizeSmokeArtifactRuns,
  getSmokeArtifactFilterCounts,
  getSmokeArtifactExpiryState,
  getSmokeArtifactRemainingLabel,
  type SmokeArtifactFilter,
  type SmokeArtifactExpiryState,
} from "./smokeArtifactExpiry";

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

const ARTIFACT_EXPIRY_LABELS: Record<SmokeArtifactExpiryState, string> = {
  active: "만료",
  expiring_soon: "만료 임박",
  expired: "만료됨",
};

const ARTIFACT_EXPIRY_STYLES: Record<SmokeArtifactExpiryState, string> = {
  active: "text-slate-500 dark:text-slate-400",
  expiring_soon: "bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  expired: "bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

const ARTIFACT_CLOCK_INTERVAL_MS = 60_000;

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
  const [artifactFilter, setArtifactFilter] = useState<SmokeArtifactFilter>("all");
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
  const artifactFilterCounts = getSmokeArtifactFilterCounts(failedRuns, periodReferenceTime);
  const filteredFailedRuns = filterAndPrioritizeSmokeArtifactRuns(
    failedRuns,
    artifactFilter,
    periodReferenceTime,
  );
  const displayedFailedRuns = filteredFailedRuns.slice(0, 5);
  const artifactCount = displayedFailedRuns.filter((run) =>
    Boolean(
      run.artifact_url &&
      getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime) !== "expired",
    )
  ).length;
  const expiredArtifactCount = displayedFailedRuns.filter((run) =>
    Boolean(
      run.artifact_url &&
      getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime) === "expired",
    )
  ).length;
  const artifactExpiryCount = displayedFailedRuns.filter((run) =>
    run.artifact_url && getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime)
  ).length;
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
          data-artifact-expiry-count={artifactExpiryCount}
          data-artifact-filter={artifactFilter}
          data-expired-artifact-count={expiredArtifactCount}
          data-filtered-run-count={filteredFailedRuns.length}
          data-testid="smoke-failure-run-links"
        >
          <span className="font-semibold">실패 실행</span>
          <select
            aria-label="실패 실행 Artifact 필터"
            className="rounded border border-current/20 bg-white/80 px-1 py-0.5 font-semibold dark:bg-slate-950/70"
            value={artifactFilter}
            onChange={(event) => setArtifactFilter(event.target.value as SmokeArtifactFilter)}
          >
            <option data-count={artifactFilterCounts.all} value="all">
              전체 ({artifactFilterCounts.all})
            </option>
            <option data-count={artifactFilterCounts.available} value="available">
              다운로드 가능 ({artifactFilterCounts.available})
            </option>
            <option data-count={artifactFilterCounts.expiring_soon} value="expiring_soon">
              만료 임박 ({artifactFilterCounts.expiring_soon})
            </option>
            <option data-count={artifactFilterCounts.expired} value="expired">
              만료됨 ({artifactFilterCounts.expired})
            </option>
          </select>
          {displayedFailedRuns.map((run, index) => {
            const runLabel = run.run_number ? `#${run.run_number}` : `${index + 1}번`;
            const artifactExpiryState = getSmokeArtifactExpiryState(
              run.artifact_expires_at,
              periodReferenceTime,
            );
            const artifactRemainingLabel = getSmokeArtifactRemainingLabel(
              run.artifact_expires_at,
              periodReferenceTime,
            );
            return (
              <span
                key={run.run_url}
                className="inline-flex items-center gap-1"
                data-artifact-expires-at={run.artifact_expires_at || undefined}
                data-artifact-state={artifactExpiryState || (run.artifact_url ? "available" : "none")}
                data-testid="smoke-failure-run"
              >
                <a
                  className="font-semibold text-rose-700 underline underline-offset-2 dark:text-rose-300"
                  href={run.run_url}
                  target="_blank"
                  rel="noreferrer"
                  title={getRunTooltip(run, timezone)}
                >
                  {runLabel}
                </a>
                {run.artifact_url && artifactExpiryState === "expired" ? (
                  <span
                    aria-disabled="true"
                    className="cursor-not-allowed font-semibold text-slate-500 line-through dark:text-slate-400"
                    data-testid="smoke-failure-artifact-expired"
                    title="보관 기간이 끝나 실패 화면을 다운로드할 수 없습니다"
                  >
                    화면 만료
                  </span>
                ) : run.artifact_url ? (
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
                {run.artifact_url && run.artifact_expires_at && artifactExpiryState ? (
                  <span
                    className={`rounded ${ARTIFACT_EXPIRY_STYLES[artifactExpiryState]}`}
                    data-expiry-state={artifactExpiryState}
                    data-remaining-label={artifactRemainingLabel || undefined}
                    data-testid="smoke-artifact-expiry"
                    title={`Artifact 만료 시각: ${formatDateTime(run.artifact_expires_at, timezone)}`}
                  >
                    {ARTIFACT_EXPIRY_LABELS[artifactExpiryState]}
                    {artifactRemainingLabel ? ` · ${artifactRemainingLabel}` : ""}
                    {` · ${formatDateTime(run.artifact_expires_at, timezone)}`}
                  </span>
                ) : null}
              </span>
            );
          })}
          {displayedFailedRuns.length === 0 ? <span>조건에 맞는 실행 없음</span> : null}
          {filteredFailedRuns.length > 5 ? <span>외 {filteredFailedRuns.length - 5}건</span> : null}
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

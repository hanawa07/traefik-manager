"use client";

import type {
  SmokeLocalRun,
  SmokeStatisticsSnapshot,
} from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatDurationSeconds } from "@/shared/lib/formatDurationSeconds";
import {
  downloadSmokeLocalRuns,
  downloadSmokeStatisticsSnapshots,
  getSmokeRunUrl,
  getSmokeStatisticsSnapshotComparison,
} from "./smokeStatisticsHistory";

interface SmokeRunStatisticsHistoryProps {
  localRuns: SmokeLocalRun[];
  localRunRetentionDays: number;
  localRunTotal: number;
  snapshots: SmokeStatisticsSnapshot[];
  timezone?: string;
  workflowUrl: string;
}

export function SmokeRunStatisticsHistory({
  localRuns,
  localRunRetentionDays,
  localRunTotal,
  snapshots,
  timezone,
  workflowUrl,
}: SmokeRunStatisticsHistoryProps) {
  const comparison = getSmokeStatisticsSnapshotComparison(snapshots);

  return (
    <details
      className="basis-full rounded-md border border-current/15 bg-white/40 px-2.5 py-2 dark:bg-slate-950/30"
      data-local-run-count={localRunTotal}
      data-snapshot-count={snapshots.length}
      data-testid="smoke-statistics-history"
    >
      <summary className="cursor-pointer font-semibold">
        로컬 기록 · 통계 {snapshots.length}회 · 실행 {localRunTotal}건
      </summary>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-3xl opacity-75">
          통계는 GitHub API를 추가 호출하지 않고 확인한 날의 30일 집계를 날짜별 한 건 저장합니다.
          실행 이력은 스모크 콜백이 대시보드를 열지 않아도 직접 기록합니다.
        </p>
        {snapshots.length ? (
          <button
            className="rounded-md border border-current/20 bg-white/70 px-2 py-1 font-semibold hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
            data-testid="smoke-statistics-csv"
            onClick={() => downloadSmokeStatisticsSnapshots(snapshots)}
            type="button"
          >
            통계 CSV 내보내기
          </button>
        ) : null}
      </div>
      {comparison ? (
        <p
          className="mt-2 rounded bg-cyan-50 px-2 py-1.5 font-semibold text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100"
          data-testid="smoke-statistics-comparison"
        >
          직전 {comparison.previousCapturedOn} 대비 · 실패율{" "}
          {formatSignedNumber(comparison.failureRatePercentagePoints)}%p · 평균{" "}
          {formatSignedDuration(comparison.averageDurationSeconds)} · 예상 사용량{" "}
          {formatSignedNumber(comparison.estimatedRunnerMinutes)} runner분
        </p>
      ) : snapshots.length ? (
        <p className="mt-2 opacity-70" data-testid="smoke-statistics-comparison-pending">
          직전 기록이 쌓이면 변화량을 표시합니다.
        </p>
      ) : null}
      {snapshots.length ? (
        <ol className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 tabular-nums">
          {snapshots.map((snapshot) => {
            const failureRateRuns = snapshot.success_count + snapshot.failure_count;
            const failureRate = failureRateRuns
              ? Math.round((snapshot.failure_count / failureRateRuns) * 100)
              : 0;
            return (
              <li
                key={snapshot.captured_on}
                className="grid gap-1 rounded bg-white/60 px-2 py-1.5 dark:bg-slate-900/60 sm:grid-cols-[6.5rem_1fr_auto_auto] sm:items-center"
              >
                <time dateTime={snapshot.captured_on}>{snapshot.captured_on}</time>
                <span>
                  실패율 {failureRate}% ({snapshot.failure_count}/{failureRateRuns})
                </span>
                <span>평균 {formatDurationSeconds(snapshot.average_duration_seconds)}</span>
                <span>{snapshot.estimated_runner_minutes} runner분</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="mt-3 border-t border-current/15 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            콜백 실행 이력 {localRunTotal}건 · 최대 {localRunRetentionDays}일 보관
          </p>
          {localRuns.length ? (
            <button
              className="rounded-md border border-current/20 bg-white/70 px-2 py-1 font-semibold hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
              data-testid="smoke-local-runs-csv"
              onClick={() => downloadSmokeLocalRuns(localRuns, workflowUrl)}
              type="button"
            >
              실행 CSV 내보내기
            </button>
          ) : null}
        </div>
        {localRuns.length ? (
          <ol className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 tabular-nums">
            {localRuns.map((run) => (
              <li
                key={run.run_id}
                className="grid gap-1 rounded bg-white/60 px-2 py-1.5 dark:bg-slate-900/60 sm:grid-cols-[5rem_4rem_1fr_auto_auto] sm:items-center"
              >
                <a
                  className="font-semibold underline decoration-current/40 underline-offset-2"
                  data-testid="smoke-local-run-link"
                  href={getSmokeRunUrl(workflowUrl, run.run_id)}
                  rel="noreferrer"
                  target="_blank"
                >
                  #{run.run_id}
                </a>
                <span className={run.status === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                  {run.status === "success" ? "성공" : "실패"}
                </span>
                <time dateTime={run.completed_at}>{formatDateTime(run.completed_at, timezone)}</time>
                <span>
                  {run.duration_seconds === null
                    ? "시간 미측정"
                    : formatDurationSeconds(run.duration_seconds)}
                </span>
                <span>{run.admin_checked ? "관리자 포함" : "viewer"}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 opacity-70">새 스모크 콜백부터 실행 이력이 쌓입니다.</p>
        )}
      </div>
    </details>
  );
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatSignedDuration(value: number): string {
  if (value === 0) return formatDurationSeconds(0);
  return `${value > 0 ? "+" : "-"}${formatDurationSeconds(Math.abs(value))}`;
}

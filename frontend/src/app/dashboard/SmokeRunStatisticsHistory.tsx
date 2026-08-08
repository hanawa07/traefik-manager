"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type {
  SmokeLocalRun,
  SmokeStatisticsSnapshot,
} from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  formatDurationSeconds,
  formatSignedDurationSeconds,
} from "@/shared/lib/formatDurationSeconds";
import { replaceBrowserQueryParams } from "@/shared/lib/replaceBrowserQueryParams";
import {
  downloadSmokeLocalRuns,
  downloadSmokeStatisticsSnapshots,
  filterSmokeLocalRuns,
  getSmokeLocalRunDurationSummary,
  getSmokeRunUrl,
  getSmokeStatisticsSnapshotComparison,
  parseSmokeLocalRunAdminFilter,
  parseSmokeLocalRunStatusFilter,
  SMOKE_LOCAL_RUN_QUERY,
  type SmokeLocalRunAdminFilter,
  type SmokeLocalRunStatusFilter,
} from "./smokeStatisticsHistory";

interface SmokeRunStatisticsHistoryProps {
  localRuns: SmokeLocalRun[];
  localRunLimit: number;
  localRunRetentionDays: number;
  localRunTotal: number;
  snapshots: SmokeStatisticsSnapshot[];
  timezone?: string;
  workflowUrl: string;
}

export function SmokeRunStatisticsHistory(props: SmokeRunStatisticsHistoryProps) {
  return (
    <Suspense fallback={null}>
      <SmokeRunStatisticsHistoryContent {...props} />
    </Suspense>
  );
}

function SmokeRunStatisticsHistoryContent({
  localRuns,
  localRunLimit,
  localRunRetentionDays,
  localRunTotal,
  snapshots,
  timezone,
  workflowUrl,
}: SmokeRunStatisticsHistoryProps) {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<SmokeLocalRunStatusFilter>(() =>
    parseSmokeLocalRunStatusFilter(searchParams.get(SMOKE_LOCAL_RUN_QUERY.status)),
  );
  const [adminFilter, setAdminFilter] = useState<SmokeLocalRunAdminFilter>(() =>
    parseSmokeLocalRunAdminFilter(searchParams.get(SMOKE_LOCAL_RUN_QUERY.admin)),
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const comparison = getSmokeStatisticsSnapshotComparison(snapshots);
  const filteredLocalRuns = filterSmokeLocalRuns(localRuns, statusFilter, adminFilter);
  const durationSummary = getSmokeLocalRunDurationSummary(localRuns);
  const successCount = localRuns.filter((run) => run.status === "success").length;
  const failureCount = localRuns.filter((run) => run.status === "failure").length;
  const adminCount = localRuns.filter((run) => run.admin_checked).length;
  const updateStatusFilter = (value: SmokeLocalRunStatusFilter) => {
    setStatusFilter(value);
    setCopyStatus("idle");
    replaceBrowserQueryParams([[SMOKE_LOCAL_RUN_QUERY.status, value, "all"]]);
  };
  const updateAdminFilter = (value: SmokeLocalRunAdminFilter) => {
    setAdminFilter(value);
    setCopyStatus("idle");
    replaceBrowserQueryParams([[SMOKE_LOCAL_RUN_QUERY.admin, value, "all"]]);
  };
  const copyFilterLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <details
      className="basis-full rounded-md border border-current/15 bg-white/40 px-2.5 py-2 dark:bg-slate-950/30"
      data-filtered-local-run-count={filteredLocalRuns.length}
      data-local-run-admin-filter={adminFilter}
      data-local-run-copy-status={copyStatus}
      data-local-run-count={localRunTotal}
      data-local-run-display-limit={localRunLimit}
      data-local-run-status-filter={statusFilter}
      data-local-run-visible-count={localRuns.length}
      data-snapshot-count={snapshots.length}
      data-testid="smoke-statistics-history"
    >
      <summary className="cursor-pointer font-semibold">
        Manager 저장 기록 · 통계 {snapshots.length}회 · 실행 {localRunTotal}건
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
          {formatSignedDurationSeconds(comparison.averageDurationSeconds)} · 예상 사용량{" "}
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">GitHub 콜백 실행 이력</p>
            <p className="mt-1 tabular-nums" data-testid="smoke-local-run-counts">
              전체 보관 {localRunTotal}건 · 화면 최근 {localRuns.length}/{localRunLimit}건 · 현재
              조건 {filteredLocalRuns.length}건
            </p>
            <p className="mt-1 opacity-70">
              완료 시각 기준 최대 {localRunRetentionDays}일 보관하며 새 콜백 저장 시 지난 기록을
              자동 정리합니다.
            </p>
          </div>
          {filteredLocalRuns.length ? (
            <button
              className="rounded-md border border-current/20 bg-white/70 px-2 py-1 font-semibold hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
              data-export-count={filteredLocalRuns.length}
              data-testid="smoke-local-runs-csv"
              onClick={() => downloadSmokeLocalRuns(filteredLocalRuns, workflowUrl)}
              type="button"
            >
              현재 조건 CSV
            </button>
          ) : null}
        </div>
        {durationSummary.latestRunId ? (
          <p
            className="mt-2 rounded bg-white/60 px-2 py-1.5 font-semibold dark:bg-slate-900/60"
            data-testid="smoke-local-duration-comparison"
          >
            최근 실행 #{durationSummary.latestRunId} ·{" "}
            {durationSummary.latestDurationSeconds === null
              ? "시간 미측정"
              : formatDurationSeconds(durationSummary.latestDurationSeconds)}
            {" · "}
            {durationSummary.durationDeltaSeconds === null
              ? "직전 비교 대기"
              : `직전 대비 ${formatSignedDurationSeconds(durationSummary.durationDeltaSeconds)}`}
          </p>
        ) : null}
        {durationSummary.slowestRuns.length ? (
          <div className="mt-2" data-testid="smoke-local-slowest-runs">
            <p className="opacity-75">
              느린 실행 상위 {durationSummary.slowestRuns.length}건 · 화면 최근 {localRuns.length}건 기준
            </p>
            <ol className="mt-1 flex flex-wrap gap-1.5">
              {durationSummary.slowestRuns.map((run) => (
                <li key={run.run_id}>
                  <a
                    className="inline-flex rounded-full border border-current/20 px-2 py-1 font-semibold hover:bg-white/70 dark:hover:bg-slate-900/70"
                    data-testid="smoke-local-slowest-run"
                    href={getSmokeRunUrl(workflowUrl, run.run_id)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    #{run.run_id} · {formatDurationSeconds(run.duration_seconds ?? 0)}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {localRuns.length ? (
          <>
            <div
              className="mt-2 flex flex-wrap gap-2"
              data-testid="smoke-local-run-filters"
            >
              <label className="inline-flex items-center gap-1">
                결과
                <select
                  aria-label="로컬 스모크 실행 결과 필터"
                  className="rounded border border-current/20 bg-white/80 px-1.5 py-1 dark:bg-slate-950/80"
                  onChange={(event) =>
                    updateStatusFilter(event.target.value as SmokeLocalRunStatusFilter)
                  }
                  value={statusFilter}
                >
                  <option data-count={localRuns.length} value="all">전체 ({localRuns.length})</option>
                  <option data-count={successCount} value="success">성공 ({successCount})</option>
                  <option data-count={failureCount} value="failure">실패 ({failureCount})</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-1">
                관리자 점검
                <select
                  aria-label="로컬 스모크 관리자 포함 필터"
                  className="rounded border border-current/20 bg-white/80 px-1.5 py-1 dark:bg-slate-950/80"
                  onChange={(event) =>
                    updateAdminFilter(event.target.value as SmokeLocalRunAdminFilter)
                  }
                  value={adminFilter}
                >
                  <option data-count={localRuns.length} value="all">전체 ({localRuns.length})</option>
                  <option data-count={adminCount} value="admin">관리자 포함 ({adminCount})</option>
                  <option data-count={localRuns.length - adminCount} value="viewer">viewer ({localRuns.length - adminCount})</option>
                </select>
              </label>
              <button
                aria-label="현재 로컬 스모크 필터 링크 복사"
                aria-live="polite"
                className="rounded border border-current/20 bg-white/70 px-2 py-1 font-semibold dark:bg-slate-950/70"
                data-testid="smoke-local-filter-copy"
                onClick={() => void copyFilterLink()}
                type="button"
              >
                {copyStatus === "copied"
                  ? "링크 복사됨"
                  : copyStatus === "error"
                    ? "링크 복사 실패"
                    : "현재 필터 링크 복사"}
              </button>
            </div>
            {filteredLocalRuns.length ? (
              <ol className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 tabular-nums">
                {filteredLocalRuns.map((run) => (
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
              <p className="mt-2 opacity-70">현재 필터 조건에 맞는 실행이 없습니다.</p>
            )}
          </>
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

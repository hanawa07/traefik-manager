import type { SmokeLocalRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  formatDurationSeconds,
  formatSignedDurationSeconds,
} from "@/shared/lib/formatDurationSeconds";

interface SmokeHostRunTrendProps {
  limit: number;
  retentionDays: number;
  runs: SmokeLocalRun[];
  timezone?: string;
  total: number;
}

type MeasuredHostRun = SmokeLocalRun & { duration_seconds: number };

export function SmokeHostRunTrend({
  limit,
  retentionDays,
  runs,
  timezone,
  total,
}: SmokeHostRunTrendProps) {
  const measuredRuns = runs.filter(isMeasuredRun);
  const latest = runs[0];
  const latestFailure = runs.find((run) => run.status === "failure");
  const failureCount = runs.filter((run) => run.status === "failure").length;
  const latestFailureRecovered = Boolean(latestFailure && latest?.status === "success");
  const latestMeasured = measuredRuns[0];
  const previousMeasured = measuredRuns[1];
  const averageSeconds = measuredRuns.length
    ? Math.round(
        measuredRuns.reduce((sum, run) => sum + run.duration_seconds, 0) /
          measuredRuns.length,
      )
    : null;
  const durationDelta =
    latestMeasured && previousMeasured
      ? latestMeasured.duration_seconds - previousMeasured.duration_seconds
      : null;

  return (
    <div
      className="mt-2 text-[11px]"
      data-host-run-total={total}
      data-host-run-visible={runs.length}
      data-host-failure-count={failureCount}
      data-smoke-history-access="local"
      data-testid="smoke-run-trend"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">운영 점검 추이</span>
        <span>Tailnet 호스트의 월간 로컬 점검을 사용합니다.</span>
        {latest ? (
          <span className="font-semibold" data-testid="smoke-host-latest-duration">
            최근 {latest.status === "success" ? "성공" : "실패"} ·{" "}
            {latest.duration_seconds === null
              ? "시간 미측정"
              : formatDurationSeconds(latest.duration_seconds)}
          </span>
        ) : (
          <span>새 로컬 점검부터 실행시간을 기록합니다.</span>
        )}
        {durationDelta === null ? null : (
          <span>직전 대비 {formatSignedDurationSeconds(durationDelta)}</span>
        )}
        {averageSeconds === null ? null : (
          <span>
            최근 {measuredRuns.length}건 평균 {formatDurationSeconds(averageSeconds)}
          </span>
        )}
      </div>
      {latestFailure ? (
        <div
          className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 border-l-2 pl-2 ${
            latestFailureRecovered
              ? "border-slate-400 text-slate-700 dark:text-slate-300"
              : "border-rose-500 text-rose-800 dark:text-rose-200"
          }`}
          data-host-failure-state={latestFailureRecovered ? "recovered" : "active"}
          data-testid="smoke-host-latest-failure"
          role={latestFailureRecovered ? undefined : "alert"}
        >
          <span className="font-semibold">
            {latestFailureRecovered ? "최근 실패 원인 · 이후 점검 성공" : "현재 실패 원인"}
          </span>
          <span className="min-w-0 break-all">
            단계·대상: {latestFailure.detail || "기록 없음"}
          </span>
          <time dateTime={latestFailure.completed_at}>
            완료: {formatDateTime(latestFailure.completed_at, timezone)}
          </time>
          <span>
            배포: <code>{latestFailure.revision?.slice(0, 12) || "기록 없음"}</code>
          </span>
        </div>
      ) : null}
      <details className="mt-2 rounded-md border border-current/15 bg-white/40 px-2.5 py-2 dark:bg-slate-950/30">
        <summary className="cursor-pointer font-semibold">
          호스트 실행 이력 · 전체 {total}건 · 최근 {runs.length}/{limit}건
        </summary>
        <p className="mt-1 opacity-75">
          완료 시각 기준 최대 {retentionDays}일 보관하며 새 점검 저장 시 지난 기록을 자동
          정리합니다.
        </p>
        {runs.length ? (
          <ol className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 tabular-nums">
            {runs.map((run) => (
              <li
                className="grid gap-1 rounded bg-white/60 px-2 py-1.5 dark:bg-slate-900/60 sm:grid-cols-[4rem_1fr_auto_auto] sm:items-center"
                key={run.run_id}
              >
                <span
                  className={
                    run.status === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }
                >
                  {run.status === "success" ? "성공" : "실패"}
                </span>
                <time dateTime={run.completed_at}>
                  {formatDateTime(run.completed_at, timezone)}
                </time>
                <span>
                  {run.duration_seconds === null
                    ? "시간 미측정"
                    : formatDurationSeconds(run.duration_seconds)}
                </span>
                <code title={run.detail || undefined}>
                  {run.revision?.slice(0, 12) || "커밋 없음"}
                </code>
                {run.status === "failure" ? (
                  <span className="min-w-0 break-all text-rose-700 dark:text-rose-300 sm:col-span-4">
                    실패 단계·대상: {run.detail || "기록 없음"}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </details>
      <p className="mt-1 opacity-75">
        전환 전 GitHub 실행 통계와 로컬 콜백 이력은 관리자 계정에서 확인합니다. 현재 운영
        판정에는 사용하지 않습니다.
      </p>
    </div>
  );
}

function isMeasuredRun(run: SmokeLocalRun): run is MeasuredHostRun {
  return run.duration_seconds !== null;
}

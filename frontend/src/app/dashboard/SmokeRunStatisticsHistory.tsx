import type { SmokeStatisticsSnapshot } from "@/features/settings/api/settingsApi";
import { formatDurationSeconds } from "@/shared/lib/formatDurationSeconds";

interface SmokeRunStatisticsHistoryProps {
  snapshots: SmokeStatisticsSnapshot[];
}

export function SmokeRunStatisticsHistory({ snapshots }: SmokeRunStatisticsHistoryProps) {
  if (!snapshots.length) return null;

  return (
    <details
      className="basis-full rounded-md border border-current/15 bg-white/40 px-2.5 py-2 dark:bg-slate-950/30"
      data-snapshot-count={snapshots.length}
      data-testid="smoke-statistics-history"
    >
      <summary className="cursor-pointer font-semibold">
        로컬 장기 추이 {snapshots.length}회
      </summary>
      <p className="mt-2 opacity-75">
        GitHub API를 추가 호출하지 않고 원격 통계를 확인한 날의 30일 롤링 집계를 날짜별 한 건,
        최대 365일 보관합니다.
      </p>
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
    </details>
  );
}

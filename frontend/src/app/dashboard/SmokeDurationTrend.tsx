import type {
  SmokeLocalRun,
  SmokeRunStatistics,
} from "@/features/settings/api/settingsApi";
import {
  formatDurationSeconds,
  formatSignedDurationSeconds,
} from "@/shared/lib/formatDurationSeconds";

import {
  getSmokeDurationTrend,
  getSmokeRunUrl,
} from "./smokeStatisticsHistory";

interface SmokeDurationTrendProps {
  localRuns: SmokeLocalRun[];
  statistics: SmokeRunStatistics[];
  workflowUrl: string;
}

export function SmokeDurationTrend({
  localRuns,
  statistics,
  workflowUrl,
}: SmokeDurationTrendProps) {
  const trend = getSmokeDurationTrend(statistics, localRuns);

  return (
    <div
      className={`basis-full rounded-md border px-2.5 py-2 ${trend.isDelayed ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" : "border-current/15 bg-white/40 dark:bg-slate-950/30"}`}
      data-smoke-duration-delay={trend.isDelayed ? "delayed" : "normal"}
      data-testid="smoke-duration-trend"
      role={trend.isDelayed ? "alert" : undefined}
    >
      <p className="font-semibold">
        실행시간 평균 · 7일 {formatAverage(trend.sevenDayAverageSeconds, trend.sevenDayRunCount)}
        {" · "}30일 {formatAverage(trend.thirtyDayAverageSeconds, trend.thirtyDayRunCount)}
        {trend.averageDeltaSeconds === null
          ? null
          : ` · 30일 대비 ${formatSignedDurationSeconds(trend.averageDeltaSeconds)}`}
      </p>
      {trend.latestRun ? (
        <a
          className="mt-1 inline-flex font-semibold underline decoration-current/40 underline-offset-2"
          data-testid="smoke-duration-latest-run"
          href={getSmokeRunUrl(workflowUrl, trend.latestRun.run_id)}
          rel="noreferrer"
          target="_blank"
          title="급격한 지연은 7일 측정 3건 이상에서 평균보다 50% 및 30초 이상 느릴 때 표시합니다."
        >
          최근 측정 #{trend.latestRun.run_id} · {formatDurationSeconds(trend.latestRun.duration_seconds)}
          {trend.latestDeltaSeconds === null
            ? null
            : ` · 7일 평균 대비 ${formatSignedDurationSeconds(trend.latestDeltaSeconds)}`}
          {trend.isDelayed ? " · 급격한 지연" : ""}
        </a>
      ) : null}
    </div>
  );
}

function formatAverage(value: number | null, count: number): string {
  return value === null ? "측정 없음" : `${formatDurationSeconds(value)} (${count}건)`;
}

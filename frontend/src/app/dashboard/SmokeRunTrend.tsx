import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

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
  runs: SmokeMonitoringRecentRun[];
  timezone?: string;
}

export function SmokeRunTrend({ error, runs, timezone }: SmokeRunTrendProps) {
  const recent = runs.slice(0, 5).reverse();
  if (!recent.length) {
    return (
      <p className="mt-2 flex items-center gap-2 text-[11px] opacity-80">
        <span className="font-semibold">최근 실행 추이</span>
        <span>{error ? "확인 실패" : "이력 없음"}</span>
      </p>
    );
  }

  const successCount = recent.filter((run) => run.status === "success").length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" data-testid="smoke-run-trend">
      <span className="font-semibold">최근 실행 추이</span>
      <div
        className="flex items-center gap-1"
        aria-label={`최근 ${recent.length}회 중 ${successCount}회 성공`}
      >
        {recent.map((run) => {
          const tooltip = getRunTooltip(run, timezone);
          return (
            <a
              key={run.run_url}
              className={`h-2.5 w-7 rounded-full transition-colors ${STATUS_STYLES[run.status]}`}
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

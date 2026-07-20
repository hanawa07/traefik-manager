import type { TrackedManualSmokeRun } from "@/features/settings/lib/smokeManualRunTracking";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const STATUS_LABELS: Record<TrackedManualSmokeRun["status"], string> = {
  success: "성공",
  failure: "실패",
  skipped: "건너뜀",
};

const STATUS_STYLES: Record<TrackedManualSmokeRun["status"], string> = {
  success: "text-emerald-700 dark:text-emerald-300",
  failure: "text-rose-700 dark:text-rose-300",
  skipped: "text-slate-600 dark:text-slate-300",
};

export function SmokeManualRunResult({
  onClear,
  run,
  timezone,
}: {
  onClear: () => void;
  run: TrackedManualSmokeRun;
  timezone?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <a
        className={`font-medium underline-offset-2 hover:underline ${STATUS_STYLES[run.status]}`}
        data-manual-run-status={run.status}
        data-testid="smoke-last-manual-run"
        href={run.run_url}
        rel="noreferrer"
        target="_blank"
      >
        {STATUS_LABELS[run.status]} · {run.run_number ? `#${run.run_number} · ` : ""}
        {formatDateTime(run.completed_at, timezone)}
      </a>
      <button
        aria-label="마지막 수동 점검 결과 기록 지우기"
        className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline dark:text-slate-400 dark:hover:text-rose-300"
        type="button"
        onClick={onClear}
      >
        기록 지우기
      </button>
    </span>
  );
}

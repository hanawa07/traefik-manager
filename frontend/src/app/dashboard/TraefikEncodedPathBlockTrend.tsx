import type { TraefikEncodedPathBlockSummary } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikEncodedPathBlockTrendProps {
  summary: TraefikEncodedPathBlockSummary;
  timezone?: string;
}

export function TraefikEncodedPathBlockTrend({
  summary,
  timezone,
}: TraefikEncodedPathBlockTrendProps) {
  const maxCount = Math.max(
    1,
    ...summary.buckets.map((bucket) => bucket.blocked_request_count),
  );

  return (
    <div className="mt-4" data-testid="encoded-path-block-trend">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
        <span>최근 {summary.window_hours}시간 영속 집계</span>
        <span>수집 범위 {summary.sample_coverage_percent}%</span>
      </div>
      <div
        aria-label={`최근 ${summary.window_hours}시간 인코딩 경로 차단 추이`}
        className="flex h-20 items-end gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 pt-3 dark:border-slate-700 dark:bg-slate-950"
        role="img"
      >
        {summary.buckets.map((bucket) => {
          const height = bucket.blocked_request_count
            ? Math.max(10, (bucket.blocked_request_count / maxCount) * 100)
            : 4;
          return (
            <span
              key={bucket.started_at}
              aria-label={`${formatDateTime(bucket.started_at, timezone)} ${bucket.blocked_request_count}건`}
              className={`min-w-0 flex-1 rounded-t ${
                bucket.blocked_request_count
                  ? "bg-amber-500 dark:bg-amber-400"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
              data-block-count={bucket.blocked_request_count}
              style={{ height: `${height}%` }}
              title={`${formatDateTime(bucket.started_at, timezone)} · ${bucket.blocked_request_count}건`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400 dark:text-slate-500">
        <span>{summary.window_hours}시간 전</span>
        <span>현재</span>
      </div>
    </div>
  );
}

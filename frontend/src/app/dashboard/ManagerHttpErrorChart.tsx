import Link from "next/link";

import type { ManagerHttpErrorSummary } from "@/features/deployment/api/deploymentApi";
import { formatDateTime, resolveDisplayTimeZone } from "@/shared/lib/dateTimeFormat";

import { ManagerHttpDeploymentCorrelation } from "./ManagerHttpDeploymentCorrelation";

interface ManagerHttpErrorChartProps {
  summary: ManagerHttpErrorSummary;
  timezone?: string;
}

export function ManagerHttpErrorChart({ summary, timezone }: ManagerHttpErrorChartProps) {
  const maxBucketCount = Math.max(
    1,
    ...summary.buckets.map((bucket) => bucket.not_found_count + bucket.server_error_count),
  );

  return (
    <div className="space-y-4 p-4">
      {summary.sample_coverage_percent === 100 ? (
        <Link
          className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
          data-testid="manager-http-sample-ready"
          href="/dashboard/settings"
        >
          24시간 표본 충족 · 설정에서 권장 임계치를 다시 검토할 수 있습니다.
        </Link>
      ) : null}
      <div
        className="w-full min-w-0 max-w-full overflow-x-auto pb-1"
        data-horizontal-scroll
        data-testid="manager-http-error-chart-scroll"
      >
        <div
          aria-label={`최근 ${summary.window_hours}시간 Manager API 오류 막대 차트`}
          className="flex h-36 min-w-[640px] items-end gap-1.5"
          role="img"
        >
          {summary.buckets.map((bucket, index) => {
            const total = bucket.not_found_count + bucket.server_error_count;
            const totalHeight = total === 0 ? 0 : Math.max(7, (total / maxBucketCount) * 100);
            const serverRatio = total === 0 ? 0 : bucket.server_error_count / total;
            return (
              <div
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                data-http-error-bucket="true"
                key={bucket.started_at}
                title={`${formatDateTime(bucket.started_at, timezone)} · 404 ${bucket.not_found_count}건 · 5xx ${bucket.server_error_count}건`}
              >
                <div
                  className="flex min-h-px w-full flex-col justify-end overflow-hidden rounded-t bg-slate-200 dark:bg-slate-800"
                  style={{ height: `${totalHeight}%` }}
                >
                  {bucket.server_error_count > 0 ? (
                    <span
                      className="w-full bg-rose-500"
                      style={{ height: `${serverRatio * 100}%` }}
                    />
                  ) : null}
                  {bucket.not_found_count > 0 ? (
                    <span
                      className="w-full bg-amber-400"
                      style={{ height: `${(1 - serverRatio) * 100}%` }}
                    />
                  ) : null}
                </div>
                <span className="mt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
                  {index % Math.max(1, Math.ceil(summary.buckets.length / 6)) === 0
                    ? formatBucketTime(bucket.started_at, timezone)
                    : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />404</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-rose-500" />5xx</span>
        <span>관측 시작: {formatDateTime(summary.observed_since, timezone)}</span>
        <span>확인: {formatDateTime(summary.checked_at, timezone)}</span>
      </div>

      <ManagerHttpDeploymentCorrelation
        correlations={summary.deployment_correlations ?? []}
        timezone={timezone}
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          오류 상위 경로
        </p>
        {summary.top_paths.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {summary.path_filter
              ? `“${summary.path_filter}” 경로 조건에 해당하는 오류가 없습니다.`
              : "관측 구간에 404 또는 5xx 응답이 없습니다."}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {summary.top_paths.map((item) => (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs" key={item.path}>
                <code className="break-all text-slate-700 dark:text-slate-200">{item.path}</code>
                <span className="text-slate-500 dark:text-slate-400">
                  404 {item.not_found_count} · 5xx {item.server_error_count} · {formatDateTime(item.last_seen_at, timezone)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBucketTime(value: string, timezone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: resolveDisplayTimeZone(timezone),
  }).format(date);
}

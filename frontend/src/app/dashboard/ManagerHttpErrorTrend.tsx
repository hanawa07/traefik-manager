import { Activity, CircleAlert } from "lucide-react";

import type { ManagerHttpErrorSummary } from "@/features/deployment/api/deploymentApi";
import { formatDateTime, resolveDisplayTimeZone } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpErrorTrendProps {
  summary?: ManagerHttpErrorSummary | null;
  timezone?: string;
}

export function ManagerHttpErrorTrend({ summary, timezone }: ManagerHttpErrorTrendProps) {
  const maxBucketCount = Math.max(
    1,
    ...(summary?.buckets ?? []).map(
      (bucket) => bucket.not_found_count + bucket.server_error_count,
    ),
  );

  return (
    <section
      className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/60"
      data-http-error-available={summary?.available ? "true" : "false"}
      data-testid="manager-http-error-trend"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Manager API 404·5xx 추이
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            backend 컨테이너 요청 로그에서 최근 24시간 오류를 집계합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <ErrorTotal label="404 Not Found" tone="amber" value={summary?.not_found_count ?? 0} />
          <ErrorTotal label="5xx 서버 오류" tone="rose" value={summary?.server_error_count ?? 0} />
        </div>
      </div>

      {!summary ? (
        <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
          오류 추이를 확인하는 중입니다.
        </p>
      ) : !summary.available ? (
        <div className="flex items-start gap-2 px-4 py-5 text-sm text-amber-700 dark:text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{summary.message}</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="overflow-x-auto pb-1" data-testid="manager-http-error-chart-scroll">
            <div
              aria-label="최근 24시간 Manager API 오류 막대 차트"
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
                      {index % 4 === 0 ? formatBucketTime(bucket.started_at, timezone) : ""}
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

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              오류 상위 경로
            </p>
            {summary.top_paths.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                관측 구간에 404 또는 5xx 응답이 없습니다.
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
      )}
    </section>
  );
}

function ErrorTotal({ label, tone, value }: { label: string; tone: "amber" | "rose"; value: number }) {
  const className = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";
  return (
    <div className={`min-w-24 rounded-lg border px-2 py-1.5 ${className}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold">{label}</p>
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

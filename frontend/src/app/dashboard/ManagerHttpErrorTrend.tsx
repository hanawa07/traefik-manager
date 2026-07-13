"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Activity, CircleAlert, Search, X } from "lucide-react";

import type {
  ManagerHttpErrorSummary,
  ManagerHttpErrorMonitorStatus,
  ManagerHttpErrorWindowHours,
} from "@/features/deployment/api/deploymentApi";
import { useManagerHttpErrors } from "@/features/deployment/hooks/useDeploymentInfo";
import { formatDateTime, resolveDisplayTimeZone } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpErrorTrendProps {
  monitor?: ManagerHttpErrorMonitorStatus | null;
  summary?: ManagerHttpErrorSummary | null;
  timezone?: string;
}

export function ManagerHttpErrorTrend({ monitor, summary, timezone }: ManagerHttpErrorTrendProps) {
  const [windowHours, setWindowHours] = useState<ManagerHttpErrorWindowHours>(24);
  const [pathFilter, setPathFilter] = useState("");
  const deferredPathFilter = useDeferredValue(pathFilter.trim());
  const hasCustomFilter = windowHours !== 24 || Boolean(deferredPathFilter);
  const query = useManagerHttpErrors(windowHours, deferredPathFilter, hasCustomFilter);
  const displayedSummary = hasCustomFilter ? query.data : summary;
  const maxBucketCount = Math.max(
    1,
    ...(displayedSummary?.buckets ?? []).map(
      (bucket) => bucket.not_found_count + bucket.server_error_count,
    ),
  );

  return (
    <section
      className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/60"
      data-http-error-available={displayedSummary?.available ? "true" : "false"}
      data-http-error-path-filter={displayedSummary?.path_filter ?? ""}
      data-http-sample-coverage={displayedSummary?.sample_coverage_percent ?? ""}
      data-http-error-window-hours={displayedSummary?.window_hours ?? ""}
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
            backend 컨테이너 요청 로그에서 최근 {windowHours}시간 오류를 집계합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <ErrorTotal label="404 Not Found" tone="amber" value={displayedSummary?.not_found_count ?? 0} />
          <ErrorTotal label="5xx 서버 오류" tone="rose" value={displayedSummary?.server_error_count ?? 0} />
        </div>
      </div>

      <HttpErrorMonitorStatus monitor={monitor} timezone={timezone} />

      <div className="grid gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          조회 기간
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            data-testid="manager-http-error-window"
            onChange={(event) =>
              setWindowHours(Number(event.target.value) as ManagerHttpErrorWindowHours)
            }
            value={windowHours}
          >
            <option value={6}>최근 6시간</option>
            <option value={12}>최근 12시간</option>
            <option value={24}>최근 24시간</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          경로 필터
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              data-testid="manager-http-error-path-filter"
              maxLength={200}
              onChange={(event) => setPathFilter(event.target.value)}
              placeholder="예: /api/v1/services"
              type="search"
              value={pathFilter}
            />
            {pathFilter ? (
              <button
                aria-label="경로 필터 지우기"
                className="absolute right-2 top-1.5 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
                onClick={() => setPathFilter("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </span>
        </label>
        {query.isError ? (
          <p className="text-xs text-rose-600 dark:text-rose-300 sm:col-span-2">
            선택한 조건의 오류 추이를 불러오지 못했습니다.
          </p>
        ) : query.isFetching ? (
          <p className="text-xs text-slate-400 sm:col-span-2">선택한 조건으로 갱신 중입니다.</p>
        ) : null}
      </div>

      {!displayedSummary ? (
        <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
          오류 추이를 확인하는 중입니다.
        </p>
      ) : !displayedSummary.available ? (
        <div className="flex items-start gap-2 px-4 py-5 text-sm text-amber-700 dark:text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{displayedSummary.message}</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {displayedSummary.sample_coverage_percent === 100 ? (
            <Link
              className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
              data-testid="manager-http-sample-ready"
              href="/dashboard/settings"
            >
              24시간 표본 충족 · 설정에서 권장 임계치를 다시 검토할 수 있습니다.
            </Link>
          ) : null}
          <div className="overflow-x-auto pb-1" data-testid="manager-http-error-chart-scroll">
            <div
              aria-label={`최근 ${displayedSummary.window_hours}시간 Manager API 오류 막대 차트`}
              className="flex h-36 min-w-[640px] items-end gap-1.5"
              role="img"
            >
              {displayedSummary.buckets.map((bucket, index) => {
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
                      {index % Math.max(1, Math.ceil(displayedSummary.buckets.length / 6)) === 0
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
            <span>관측 시작: {formatDateTime(displayedSummary.observed_since, timezone)}</span>
            <span>확인: {formatDateTime(displayedSummary.checked_at, timezone)}</span>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              오류 상위 경로
            </p>
            {displayedSummary.top_paths.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                {displayedSummary.path_filter
                  ? `“${displayedSummary.path_filter}” 경로 조건에 해당하는 오류가 없습니다.`
                  : "관측 구간에 404 또는 5xx 응답이 없습니다."}
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                {displayedSummary.top_paths.map((item) => (
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

function HttpErrorMonitorStatus({
  monitor,
  timezone,
}: {
  monitor?: ManagerHttpErrorMonitorStatus | null;
  timezone?: string;
}) {
  const status = !monitor
    ? "loading"
    : !monitor.enabled
      ? "disabled"
      : !monitor.checked_at
        ? "pending"
        : !monitor.available
          ? "unavailable"
          : monitor.breached
            ? "breached"
            : "healthy";
  const statusLabel = {
    loading: "확인 중",
    disabled: "비활성",
    pending: "첫 점검 대기",
    unavailable: "점검 실패",
    breached: "임계치 초과",
    healthy: "정상",
  }[status];
  const statusClass =
    status === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
      : status === "breached" || status === "unavailable"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <div
      className={`border-b px-4 py-3 text-xs ${statusClass}`}
      data-http-error-monitor-status={status}
      data-testid="manager-http-error-monitor-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>임계치 감지 상태: {statusLabel}</strong>
        <span>마지막 점검: {formatDateTime(monitor?.checked_at, timezone)}</span>
      </div>
      {monitor ? (
        <p className="mt-1">
          최근 {monitor.window_minutes}분 · 404 {monitor.not_found_count}/
          {monitor.not_found_threshold} · 5xx {monitor.server_error_count}/
          {monitor.server_error_threshold} · 제외 경로 {monitor.excluded_paths.length}개
        </p>
      ) : null}
    </div>
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

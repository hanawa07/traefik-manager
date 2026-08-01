"use client";

import { useDeferredValue, useState } from "react";
import { Activity, CircleAlert, Search, X } from "lucide-react";

import type {
  ManagerHttpErrorMonitorStatus,
  ManagerHttpErrorSummary,
  ManagerHttpErrorWindowHours,
  ManagerSettingsHistoryLatencyStatus,
} from "@/features/deployment/api/deploymentApi";
import { useManagerHttpErrors } from "@/features/deployment/hooks/useDeploymentInfo";

import { ManagerHttpErrorChart } from "./ManagerHttpErrorChart";
import { ManagerHttpLogStorageStatus } from "./ManagerHttpLogStorageStatus";
import { ManagerHttpMonitoringStatus } from "./ManagerHttpMonitoringStatus";

interface ManagerHttpErrorTrendProps {
  latencyMonitor?: ManagerSettingsHistoryLatencyStatus | null;
  monitor?: ManagerHttpErrorMonitorStatus | null;
  summary?: ManagerHttpErrorSummary | null;
  timezone?: string;
}

export function ManagerHttpErrorTrend({
  latencyMonitor,
  monitor,
  summary,
  timezone,
}: ManagerHttpErrorTrendProps) {
  const [windowHours, setWindowHours] = useState<ManagerHttpErrorWindowHours>(24);
  const [pathFilter, setPathFilter] = useState("");
  const deferredPathFilter = useDeferredValue(pathFilter.trim());
  const hasCustomFilter = windowHours !== 24 || Boolean(deferredPathFilter);
  const query = useManagerHttpErrors(windowHours, deferredPathFilter, hasCustomFilter);
  const displayedSummary = hasCustomFilter ? query.data : summary;

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

      <ManagerHttpMonitoringStatus
        latencyMonitor={latencyMonitor}
        monitor={monitor}
        timezone={timezone}
      />

      {displayedSummary?.log_storage ? (
        <ManagerHttpLogStorageStatus storage={displayedSummary.log_storage} />
      ) : null}

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
        <ManagerHttpErrorChart summary={displayedSummary} timezone={timezone} />
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

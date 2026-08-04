"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { Suspense } from "react";

import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { getExternalWatchdogRunLabel } from "./managerWatchdogStatus";
import {
  getWatchdogResult,
  ManagerWatchdogAlertFilters,
  useManagerWatchdogAlertFilters,
} from "./ManagerWatchdogAlertFilters";

interface ManagerWatchdogAlertHistoryProps {
  deployment?: DeploymentInfo;
  isRefreshing?: boolean;
  lastManualRefreshAt?: string;
  onRefresh?: () => void;
  timezone?: string;
}

export function ManagerWatchdogAlertHistory(props: ManagerWatchdogAlertHistoryProps) {
  return (
    <Suspense fallback={null}>
      <ManagerWatchdogAlertHistoryContent {...props} />
    </Suspense>
  );
}

function ManagerWatchdogAlertHistoryContent({
  deployment,
  isRefreshing = false,
  lastManualRefreshAt,
  onRefresh,
  timezone,
}: ManagerWatchdogAlertHistoryProps) {
  const runs = deployment?.external_watchdog_alert_runs || [];
  const { eventFilter, filteredRuns, resultCounts, resultFilter } =
    useManagerWatchdogAlertFilters(runs);

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            최근 GitHub watchdog 알림 실행
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            외부 가용성 watchdog이 요청한 최근 GitHub Actions 실행 5건입니다.
          </p>
        </div>
        <div className="grid justify-items-end gap-1">
          {onRefresh ? (
            <button
              aria-label="watchdog 실행 이력 새로고침"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
              disabled={isRefreshing}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "이력 갱신 중" : "이력 새로고침"}
            </button>
          ) : null}
          <span aria-live="polite" className="text-[11px] text-gray-500 dark:text-slate-400">
            수동 갱신: {lastManualRefreshAt ? formatDateTime(lastManualRefreshAt, timezone) : "아직 없음"}
          </span>
        </div>
      </div>

      <ManagerWatchdogAlertFilters
        eventFilter={eventFilter}
        filteredCount={filteredRuns.length}
        resultCounts={resultCounts}
        resultFilter={resultFilter}
        runCount={runs.length}
      />

      {runs.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">아직 실행 기록이 없습니다.</p>
      ) : filteredRuns.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          선택한 조건에 맞는 실행 기록이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
          {filteredRuns.map((run) => {
            const failed = getWatchdogResult(run) === "failure";
            return (
              <li className="flex flex-wrap items-start gap-2 py-3 text-xs" key={run.run_url}>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                    run.event === "failure"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                  }`}
                >
                  {run.event === "failure" ? "장애" : "복구"}
                </span>
                <div className="min-w-0 flex-[1_1_14rem]">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-gray-600 dark:text-slate-300">
                      요청: {formatDateTime(run.requested_at, timezone)}
                    </span>
                    <span
                      className={failed ? "font-semibold text-rose-700 dark:text-rose-200" : "text-gray-500 dark:text-slate-400"}
                    >
                      결과: {getExternalWatchdogRunLabel(run.status, run.conclusion, run.error)}
                    </span>
                    {run.checked_at ? (
                      <span className="text-gray-500 dark:text-slate-400">
                        결과 확인: {formatDateTime(run.checked_at, timezone)}
                      </span>
                    ) : null}
                  </div>
                  {run.error ? (
                    <p className="mt-1 break-words text-rose-700 dark:text-rose-200">
                      조회 오류: {run.error}
                    </p>
                  ) : null}
                </div>
                <a
                  className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  href={run.run_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  실행 보기
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

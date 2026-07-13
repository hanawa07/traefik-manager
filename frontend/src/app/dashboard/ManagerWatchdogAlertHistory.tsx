"use client";

import { useSearchParams } from "next/navigation";
import { ExternalLink, RefreshCw, RotateCcw, X } from "lucide-react";
import { Suspense } from "react";

import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

type WatchdogEventFilter = "all" | "failure" | "recovery";
type WatchdogResult = "success" | "failure" | "pending" | "other";
type WatchdogResultFilter = "all" | WatchdogResult;

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
  const searchParams = useSearchParams();
  const runs = deployment?.external_watchdog_alert_runs || [];
  const eventFilter = parseWatchdogEventFilter(searchParams.get("watchdog_event"));
  const resultFilter = parseWatchdogResultFilter(searchParams.get("watchdog_result"));
  const eventFilterLabel = eventFilter === "failure" ? "장애 알림" : "복구 알림";
  const resultFilterLabel =
    resultFilter === "all"
      ? ""
      : {
          success: "성공",
          failure: "실패",
          pending: "진행·확인 중",
          other: "기타 완료",
        }[resultFilter];
  const hasActiveFilters = eventFilter !== "all" || resultFilter !== "all";
  const filteredRuns = runs.filter(
    (run) =>
      (eventFilter === "all" || run.event === eventFilter) &&
      matchesResultFilter(run, resultFilter),
  );
  const resultCounts = {
    success: runs.filter((run) => getWatchdogResult(run) === "success").length,
    failure: runs.filter((run) => getWatchdogResult(run) === "failure").length,
    pending: runs.filter((run) => getWatchdogResult(run) === "pending").length,
    other: runs.filter((run) => getWatchdogResult(run) === "other").length,
  };

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            최근 watchdog 알림 실행
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

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          알림 종류
          <select
            aria-label="watchdog 알림 종류 필터"
            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            disabled={runs.length === 0}
            onChange={(event) =>
              replaceWatchdogQueryParam("watchdog_event", event.target.value)
            }
            value={eventFilter}
          >
            <option value="all">전체</option>
            <option value="failure">장애 알림</option>
            <option value="recovery">복구 알림</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실행 결과
          <select
            aria-label="watchdog 실행 결과 필터"
            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            disabled={runs.length === 0}
            onChange={(event) =>
              replaceWatchdogQueryParam("watchdog_result", event.target.value)
            }
            value={resultFilter}
          >
            <option value="all">전체</option>
            <option value="success">성공</option>
            <option value="failure">실패</option>
            <option value="pending">진행·확인 중</option>
            <option value="other">기타 완료</option>
          </select>
        </label>
        <span className="ml-auto text-[11px] text-gray-500 dark:text-slate-400">
          {filteredRuns.length}/{runs.length}건
        </span>
        <div
          aria-live="polite"
          className="flex w-full flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 text-[11px] dark:border-slate-800"
        >
          <span className="font-semibold text-slate-600 dark:text-slate-300">적용 조건</span>
          {!hasActiveFilters ? (
            <span className="text-slate-500 dark:text-slate-400">전체 실행</span>
          ) : (
            <>
              {eventFilter !== "all" ? (
                <button
                  aria-label={`watchdog ${eventFilterLabel} 조건 제거`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25"
                  onClick={() => replaceWatchdogQueryParam("watchdog_event", "all")}
                  type="button"
                >
                  {eventFilterLabel}
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              ) : null}
              {resultFilter !== "all" ? (
                <button
                  aria-label={`watchdog ${resultFilterLabel} 조건 제거`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25"
                  onClick={() => replaceWatchdogQueryParam("watchdog_result", "all")}
                  type="button"
                >
                  {resultFilterLabel}
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              ) : null}
            </>
          )}
          <button
            aria-label="watchdog 필터 전체 초기화"
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            disabled={!hasActiveFilters}
            onClick={resetWatchdogQueryParams}
            type="button"
          >
            <RotateCcw className="h-3 w-3" />
            전체 초기화
          </button>
        </div>
        <div
          aria-label="watchdog 실행 결과 집계"
          className="flex w-full flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-800"
        >
          <ResultCount label="성공" count={resultCounts.success} tone="success" />
          <ResultCount label="실패" count={resultCounts.failure} tone="failure" />
          <ResultCount label="진행·확인" count={resultCounts.pending} tone="pending" />
          <ResultCount label="기타 완료" count={resultCounts.other} tone="other" />
        </div>
      </div>

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

function matchesResultFilter(
  run: DeploymentInfo["external_watchdog_alert_runs"][number],
  filter: WatchdogResultFilter,
) {
  return filter === "all" || getWatchdogResult(run) === filter;
}

function parseWatchdogEventFilter(value: string | null): WatchdogEventFilter {
  return value === "failure" || value === "recovery" ? value : "all";
}

function parseWatchdogResultFilter(value: string | null): WatchdogResultFilter {
  return value === "success" || value === "failure" || value === "pending" || value === "other"
    ? value
    : "all";
}

function replaceWatchdogQueryParam(key: string, value: string) {
  replaceWatchdogQueryParams([[key, value]]);
}

function resetWatchdogQueryParams() {
  replaceWatchdogQueryParams([
    ["watchdog_event", "all"],
    ["watchdog_result", "all"],
  ]);
}

function replaceWatchdogQueryParams(values: [key: string, value: string][]) {
  const params = new URLSearchParams(window.location.search);
  values.forEach(([key, value]) => {
    if (value === "all") params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function getWatchdogResult(
  run: DeploymentInfo["external_watchdog_alert_runs"][number],
): WatchdogResult {
  if (run.error || isExternalWatchdogRunFailure(run.conclusion)) return "failure";
  if (run.status !== "completed") return "pending";
  if (run.conclusion === "success") return "success";
  return "other";
}

function ResultCount({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: WatchdogResult;
}) {
  const tones: Record<WatchdogResult, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    failure: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    other: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{label} {count}건</span>;
}

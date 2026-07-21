"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  settingsApi,
  type SmokeHistoryDays,
  type SmokeMonitoringRecentRun,
  type SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import { settingsQueryKeys } from "@/features/settings/hooks/settingsQueryKeys";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { SmokeArtifactExpiryLabel } from "./SmokeArtifactExpiryLabel";
import { SmokeArtifactLink } from "./SmokeArtifactLink";
import { SmokeFailureMetadataPreview } from "./SmokeFailureMetadataPreview";

type RunStatusFilter = "all" | SmokeMonitoringRecentRun["status"];

const STATUS_LABELS = {
  success: "성공",
  failure: "실패",
  skipped: "건너뜀",
} as const;

const STATUS_STYLES = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  skipped: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;

interface SmokeRecentRunHistoryProps {
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeRecentRunHistory({ status: initialStatus, timezone }: SmokeRecentRunHistoryProps) {
  const [search, setSearch] = useState("");
  const [runStatus, setRunStatus] = useState<RunStatusFilter>("all");
  const [days, setDays] = useState<SmokeHistoryDays>(initialStatus.monitoring_history_days ?? 30);
  const [page, setPage] = useState(initialStatus.monitoring_history_page ?? 1);
  const [filtersRestored, setFiltersRestored] = useState(false);

  useEffect(() => {
    const filters = readHistoryFilters();
    setSearch(filters.search);
    setRunStatus(filters.status);
    setDays(filters.days);
    setPage(filters.page);
    setFiltersRestored(true);
  }, []);

  const usesInitialHistory =
    days === initialStatus.monitoring_history_days &&
    page === initialStatus.monitoring_history_page;
  const historyQuery = useQuery({
    queryKey: settingsQueryKeys.smokeRotationHistory(days, page),
    queryFn: () => settingsApi.getSmokeRunHistory(days, page),
    enabled: filtersRestored && !usesInitialHistory,
    staleTime: 600_000,
  });
  const history = usesInitialHistory ? initialStatus : historyQuery.data;
  const runs = history?.monitoring_recent_runs ?? [];
  const total = history?.monitoring_history_total ?? runs.length;
  const totalPages = history?.monitoring_history_total_pages ?? (total ? 1 : 0);
  const referenceTime = Date.parse(history?.monitoring_history_checked_at || "");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRuns = runs.filter((run) => {
    if (runStatus !== "all" && run.status !== runStatus) return false;
    if (!normalizedSearch) return true;
    return [run.run_number, run.commit_sha, run.summary]
      .filter((value) => value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    replaceHistoryUrl({ smoke_page: null, smoke_search: value || null });
  };
  const changeStatus = (value: RunStatusFilter) => {
    setRunStatus(value);
    setPage(1);
    replaceHistoryUrl({
      smoke_page: null,
      smoke_status: value === "all" ? null : value,
    });
  };
  const changeDays = (value: SmokeHistoryDays) => {
    setDays(value);
    setPage(1);
    replaceHistoryUrl({
      smoke_days: value === 30 ? null : String(value),
      smoke_page: null,
    });
  };
  const changePage = (value: number) => {
    setPage(value);
    replaceHistoryUrl({ smoke_page: value === 1 ? null : String(value) });
  };

  return (
    <details
      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950"
      data-testid="smoke-recent-run-history"
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        최근 GitHub 원격 실행 총 {total}건
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-end">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          현재 페이지 검색
          <input
            aria-label="최근 원격 실행 검색"
            autoComplete="off"
            className="min-w-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            data-testid="smoke-recent-run-search"
            maxLength={100}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="실행 번호·커밋·요약 검색"
            spellCheck={false}
            type="search"
            value={search}
          />
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실행 상태
          <select
            aria-label="최근 원격 실행 상태"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-recent-run-status-filter"
            onChange={(event) => changeStatus(event.target.value as RunStatusFilter)}
            value={runStatus}
          >
            <option value="all">전체 ({runs.length})</option>
            <option value="success">성공 ({runs.filter((run) => run.status === "success").length})</option>
            <option value="failure">실패 ({runs.filter((run) => run.status === "failure").length})</option>
            <option value="skipped">건너뜀 ({runs.filter((run) => run.status === "skipped").length})</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          조회 기간
          <select
            aria-label="최근 원격 실행 조회 기간"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-recent-run-days-filter"
            onChange={(event) => changeDays(Number(event.target.value) as SmokeHistoryDays)}
            value={days}
          >
            <option value={7}>7일</option>
            <option value={30}>30일</option>
          </select>
        </label>
        <span
          aria-live="polite"
          className="text-[11px] text-gray-500 dark:text-slate-400"
          data-testid="smoke-recent-run-filter-count"
        >
          {filteredRuns.length}/{runs.length}건
        </span>
      </div>

      {!usesInitialHistory && historyQuery.isPending ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">원격 실행 이력을 불러오는 중입니다.</p>
      ) : historyQuery.isError && !history ? (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">원격 실행 이력을 불러오지 못했습니다.</p>
      ) : (
        <>
          {history?.monitoring_history_error ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              {history.monitoring_history_error}. 캐시된 이력이 있으면 계속 표시합니다.
            </p>
          ) : null}
          {filteredRuns.length ? (
            <ol className="mt-3 space-y-2">
              {filteredRuns.map((run) => (
                <li
                  key={run.run_id || run.run_url}
                  className="rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                  data-run-status={run.status}
                  data-testid="smoke-recent-run-item"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[run.status]}`}>
                      {STATUS_LABELS[run.status]}
                    </span>
                    <a
                      className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                      href={run.run_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {run.run_number ? `#${run.run_number}` : "실행 보기"}
                    </a>
                    {run.artifact_url ? (
                      <SmokeArtifactLink
                        artifactUrl={run.artifact_url}
                        expiresAt={run.artifact_expires_at}
                        label="실패 화면"
                        expiredLabel="화면 만료"
                        testId="smoke-recent-run-artifact-link"
                        expiredTestId="smoke-recent-run-artifact-expired"
                        referenceTime={referenceTime}
                      />
                    ) : null}
                    {run.artifact_url && run.artifact_expires_at ? (
                      <SmokeArtifactExpiryLabel
                        expiresAt={run.artifact_expires_at}
                        referenceTime={referenceTime}
                        timezone={timezone}
                      />
                    ) : null}
                    <span className="text-gray-500 dark:text-slate-400">
                      {formatDateTime(run.completed_at, timezone)}
                    </span>
                    {run.commit_sha ? (
                      <code className="text-gray-500 dark:text-slate-400">{run.commit_sha}</code>
                    ) : null}
                  </div>
                  {run.summary ? (
                    <p className="mt-2 text-gray-600 dark:text-slate-300">{run.summary}</p>
                  ) : null}
                  {run.notification_suppressed ? (
                    <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
                      중복 Telegram 알림 억제
                    </p>
                  ) : null}
                  {run.failure_metadata ? (
                    <SmokeFailureMetadataPreview metadata={run.failure_metadata} timezone={timezone} />
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
              {runs.length ? "검색 조건에 맞는 원격 실행이 없습니다." : "표시할 원격 실행이 없습니다."}
            </p>
          )}
        </>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="최근 원격 실행 페이지"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs dark:border-slate-700"
          data-testid="smoke-recent-run-pagination"
        >
          <button
            type="button"
            className="btn-secondary px-2.5 py-1.5 text-xs"
            disabled={page <= 1 || historyQuery.isFetching}
            onClick={() => changePage(page - 1)}
          >
            이전
          </button>
          <span className="text-gray-500 dark:text-slate-400">
            <strong data-testid="smoke-recent-run-page">{page}/{totalPages} 페이지</strong>
            {` · 총 ${total}건`}
          </span>
          <button
            type="button"
            className="btn-secondary px-2.5 py-1.5 text-xs"
            disabled={page >= totalPages || historyQuery.isFetching}
            onClick={() => changePage(page + 1)}
          >
            다음
          </button>
        </nav>
      ) : null}
    </details>
  );
}

function readHistoryFilters(): {
  search: string;
  status: RunStatusFilter;
  days: SmokeHistoryDays;
  page: number;
} {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("smoke_status");
  const days = Number(params.get("smoke_days"));
  const page = Number(params.get("smoke_page"));
  return {
    search: (params.get("smoke_search") || "").slice(0, 100),
    status: status === "success" || status === "failure" || status === "skipped" ? status : "all",
    days: days === 7 ? 7 : 30,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function replaceHistoryUrl(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

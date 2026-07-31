"use client";

import { useQuery } from "@tanstack/react-query";

import {
  settingsApi,
  type SmokeHistoryDays,
  type SmokeHistoryStatus,
  type SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import { settingsQueryKeys } from "@/features/settings/hooks/settingsQueryKeys";
import { SmokeRecentRunItem } from "./SmokeRecentRunItem";
import { useSmokeRecentRunFilters } from "./useSmokeRecentRunFilters";

interface SmokeRecentRunHistoryProps {
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeRecentRunHistory({ status: initialStatus, timezone }: SmokeRecentRunHistoryProps) {
  const {
    search,
    setSearch,
    appliedSearch,
    runStatus,
    days,
    page,
    filtersRestored,
    filtersAreDefault,
    applySearch,
    changeStatus,
    changeDays,
    changePage,
    resetFilters,
  } = useSmokeRecentRunFilters(initialStatus);

  const usesInitialHistory =
    days === initialStatus.monitoring_history_days &&
    page === initialStatus.monitoring_history_page &&
    appliedSearch === (initialStatus.monitoring_history_search ?? "") &&
    runStatus === (initialStatus.monitoring_history_status ?? "all");
  const historyQuery = useQuery({
    queryKey: settingsQueryKeys.smokeRotationHistory(days, page, appliedSearch, runStatus),
    queryFn: () => settingsApi.getSmokeRunHistory(days, page, appliedSearch, runStatus),
    enabled: filtersRestored && !usesInitialHistory,
    staleTime: 600_000,
  });
  const history = usesInitialHistory ? initialStatus : historyQuery.data;
  const runs = history?.monitoring_recent_runs ?? [];
  const total = history?.monitoring_history_total ?? runs.length;
  const totalPages = history?.monitoring_history_total_pages ?? (total ? 1 : 0);
  const referenceTime = Date.parse(history?.monitoring_history_checked_at || "");
  return (
    <details
      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950"
      data-testid="smoke-recent-run-history"
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        최근 GitHub 원격 실행 검색 결과 총 {total}건
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-end">
        <form
          className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <label htmlFor="smoke-recent-run-search">선택 기간 전체 검색</label>
          <div className="flex min-w-0 gap-1.5">
            <input
              id="smoke-recent-run-search"
              aria-label="최근 원격 실행 검색"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              data-testid="smoke-recent-run-search"
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="실행 번호·커밋 SHA"
              spellCheck={false}
              type="search"
              value={search}
            />
            <button className="btn-secondary px-2.5 py-1.5 text-xs" type="submit">
              검색
            </button>
          </div>
        </form>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실행 상태
          <select
            aria-label="최근 원격 실행 상태"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-recent-run-status-filter"
            onChange={(event) => changeStatus(event.target.value as SmokeHistoryStatus)}
            value={runStatus}
          >
            <option value="all">전체</option>
            <option value="success">성공·건너뜀</option>
            <option value="failure">실패</option>
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
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary px-2.5 py-1.5 text-xs"
            data-testid="smoke-recent-run-reset-filters"
            disabled={filtersAreDefault}
            onClick={resetFilters}
            type="button"
          >
            초기화
          </button>
          <span
            aria-live="polite"
            className="whitespace-nowrap text-[11px] text-gray-500 dark:text-slate-400"
            data-testid="smoke-recent-run-filter-count"
          >
            {runs.length}/{total}건
          </span>
        </div>
      </div>
      <p
        className="mt-2 text-[11px] text-gray-500 dark:text-slate-400"
        data-testid="smoke-failure-metadata-retention"
      >
        실패 정보 {history?.monitoring_failure_metadata_count ?? 0}/
        {history?.monitoring_failure_metadata_limit ?? 20}건 보관 · 초과 시 오래된 기록 자동 정리
      </p>

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
          {runs.length ? (
            <ol className="mt-3 space-y-2">
              {runs.map((run) => (
                <SmokeRecentRunItem
                  key={run.run_id || run.run_url}
                  referenceTime={referenceTime}
                  run={run}
                  timezone={timezone}
                />
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
              {total ? "현재 페이지에 표시할 실행이 없습니다." : "검색 조건에 맞는 원격 실행이 없습니다."}
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

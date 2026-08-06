"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  settingsApi,
  type SmokeCancellationReasonFilter,
  type SmokeFailureTypeRun,
  type SmokeFailureType,
  type SmokeHistoryDays,
  type SmokeHistoryStatus,
  type SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import { useClassifySmokeFailure } from "@/features/settings/hooks/useSettings";
import { settingsQueryKeys } from "@/features/settings/hooks/settingsQueryKeys";
import { SmokeFailureMetadataManagement } from "./SmokeFailureMetadataManagement";
import { SmokeFailureTypeTrend } from "./SmokeFailureTypeTrend";
import { SmokeRecentRunItem } from "./SmokeRecentRunItem";
import {
  type SmokeFailureTypeFilter,
  useSmokeRecentRunFilters,
} from "./useSmokeRecentRunFilters";

interface SmokeRecentRunHistoryProps {
  canManage: boolean;
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeRecentRunHistory({
  canManage,
  status: initialStatus,
  timezone,
}: SmokeRecentRunHistoryProps) {
  const classifyFailure = useClassifySmokeFailure();
  const historyDetailsRef = useRef<HTMLDetailsElement>(null);
  const [classificationError, setClassificationError] = useState("");
  const {
    search,
    setSearch,
    appliedSearch,
    runStatus,
    failureType,
    cancellationReason,
    days,
    page,
    filtersRestored,
    filtersAreDefault,
    applySearch,
    changeStatus,
    changeFailureType,
    changeCancellationReason,
    changeDays,
    changePage,
    resetFilters,
  } = useSmokeRecentRunFilters(initialStatus);

  useEffect(() => {
    if (!filtersRestored || window.location.hash !== "#smoke-recent-run-history") return;
    const details = historyDetailsRef.current;
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: "start" });
  }, [filtersRestored]);

  const usesInitialHistory =
    days === initialStatus.monitoring_history_days &&
    page === initialStatus.monitoring_history_page &&
    appliedSearch === (initialStatus.monitoring_history_search ?? "") &&
    runStatus === (initialStatus.monitoring_history_status ?? "all") &&
    cancellationReason === (initialStatus.monitoring_history_cancellation_reason ?? "all");
  const historyQuery = useQuery({
    queryKey: settingsQueryKeys.smokeRotationHistory(
      days,
      page,
      appliedSearch,
      runStatus,
      cancellationReason,
    ),
    queryFn: () =>
      settingsApi.getSmokeRunHistory(
        days,
        page,
        appliedSearch,
        runStatus,
        cancellationReason,
      ),
    enabled: filtersRestored && !usesInitialHistory,
    staleTime: 600_000,
  });
  const history = usesInitialHistory ? initialStatus : historyQuery.data;
  const runs = history?.monitoring_recent_runs ?? [];
  const failureRuns = runs.filter((run) => run.status === "failure");
  const failureTypeCounts: Record<SmokeFailureType, number> = {
    external_api: 0,
    login: 0,
    visual_regression: 0,
  };
  for (const run of failureRuns) {
    if (run.failure_metadata) failureTypeCounts[run.failure_metadata.failure_type] += 1;
  }
  const classifiedFailureCount = Object.values(failureTypeCounts).reduce(
    (totalCount, count) => totalCount + count,
    0,
  );
  const visibleRuns = failureType === "all"
    ? runs
    : failureRuns.filter((run) =>
        failureType === "unclassified"
          ? !run.failure_metadata
          : run.failure_metadata?.failure_type === failureType,
      );
  const total = history?.monitoring_history_total ?? runs.length;
  const totalPages = history?.monitoring_history_total_pages ?? (total ? 1 : 0);
  const periodStatistic = history?.monitoring_run_statistics.find(
    (statistic) => statistic.window_days === days,
  );
  const referenceTime = Date.parse(history?.monitoring_history_checked_at || "");
  const handleClassifyRun = async (
    run: SmokeFailureTypeRun,
    failureType: SmokeFailureType,
  ) => {
    setClassificationError("");
    try {
      await classifyFailure.mutateAsync({
        run_id: run.run_id,
        failure_type: failureType,
        completed_at: run.completed_at,
      });
    } catch {
      setClassificationError("실패 유형을 저장하지 못했습니다.");
    }
  };
  return (
    <details
      className="scroll-mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950"
      data-testid="smoke-recent-run-history"
      id="smoke-recent-run-history"
      ref={historyDetailsRef}
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        최근 GitHub 원격 실행 검색 결과 총 {total}건
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(14rem,1fr)_8rem_10rem_10rem_7rem_auto] 2xl:items-end">
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
            <option value="cancelled">취소됨 (앱 실패 제외)</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실패 유형
          <select
            aria-label="최근 원격 실행 실패 유형"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-recent-run-failure-type-filter"
            onChange={(event) =>
              changeFailureType(event.target.value as SmokeFailureTypeFilter)
            }
            value={failureType}
          >
            <option value="all">전체 유형 ({failureRuns.length})</option>
            <option value="login">로그인 ({failureTypeCounts.login})</option>
            <option value="external_api">외부 API ({failureTypeCounts.external_api})</option>
            <option value="visual_regression">
              화면 회귀 ({failureTypeCounts.visual_regression})
            </option>
            <option value="unclassified">
              미분류 ({failureRuns.length - classifiedFailureCount})
            </option>
          </select>
        </label>
        <label
          className={`grid gap-1 text-[11px] text-gray-500 dark:text-slate-400 ${runStatus === "cancelled" ? "" : "opacity-60"}`}
        >
          취소 원인
          <select
            aria-label="최근 원격 실행 취소 원인"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            data-testid="smoke-recent-run-cancellation-filter"
            disabled={runStatus !== "cancelled"}
            onChange={(event) =>
              changeCancellationReason(event.target.value as SmokeCancellationReasonFilter)
            }
            value={cancellationReason}
          >
            <option value="all">전체 취소</option>
            <option value="timeout">시간 초과</option>
            <option value="superseded">새 실행으로 대체</option>
            <option value="manual_or_unknown">수동 취소·미확인</option>
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
            {failureType === "all"
              ? `${runs.length}/${total}건`
              : `${visibleRuns.length}/${runs.length}건 · 현재 페이지`}
          </span>
        </div>
      </div>
      <SmokeFailureTypeTrend
        key={periodStatistic?.window_days}
        statistic={periodStatistic}
        persistFilters
        classifyingRunId={classifyFailure.isPending ? classifyFailure.variables?.run_id : undefined}
        classificationError={classificationError}
        onClassifyRun={handleClassifyRun}
      />
      <p
        className="mt-2 text-[11px] text-gray-500 dark:text-slate-400"
        data-testid="smoke-failure-type-counts"
      >
        현재 페이지 실패 유형 · 로그인 {failureTypeCounts.login} · 외부 API {failureTypeCounts.external_api}
        {` · 화면 회귀 ${failureTypeCounts.visual_regression}`}
        {classifiedFailureCount < failureRuns.length
          ? ` · 미분류 ${failureRuns.length - classifiedFailureCount}`
          : ""}
      </p>
      <p
        className="mt-1 text-[11px] text-gray-500 dark:text-slate-400"
        data-testid="smoke-failure-metadata-retention"
      >
        실패 정보 {history?.monitoring_failure_metadata_count ?? 0}/
        {history?.monitoring_failure_metadata_limit ?? 20}건 보관 · 초과 시 오래된 기록 자동 정리
      </p>
      {canManage ? (
        <SmokeFailureMetadataManagement
          entries={history?.monitoring_failure_metadata_entries ?? []}
          timezone={timezone}
          workflowUrl={initialStatus.monitoring_workflow_url}
        />
      ) : null}

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
          {visibleRuns.length ? (
            <ol className="mt-3 space-y-2">
              {visibleRuns.map((run) => (
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

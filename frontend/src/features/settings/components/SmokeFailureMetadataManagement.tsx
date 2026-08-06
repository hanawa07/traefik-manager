"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";

import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import { useCleanupSmokeFailureMetadata } from "@/features/settings/hooks/useSettings";
import { downloadSmokeFailureMetadata } from "@/features/settings/lib/smokeFailureMetadataExport";
import {
  filterSmokeFailureMetadata,
  sortSmokeFailureMetadata,
  type SmokeFailureMetadataPeriodFilter,
  type SmokeFailureMetadataSort,
  type SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";
import { SMOKE_FAILURE_TYPE_LABELS } from "@/features/settings/lib/smokeFailureMetadataLabels";
import { githubActionsRunUrl } from "@/features/settings/lib/smokeGithubUrls";
import { updateSmokeFailureMetadataSelection } from "@/features/settings/lib/smokeFailureMetadataSelection";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { SmokeFailureMetadataBulkSelection } from "./SmokeFailureMetadataBulkSelection";
import { SmokeFailureMetadataCleanupPreview } from "./SmokeFailureMetadataCleanupPreview";
import { SmokeFailureMetadataDateFilters } from "./SmokeFailureMetadataDateFilters";
import { SmokeFailureMetadataSavedFilters } from "./SmokeFailureMetadataSavedFilters";
import { useSmokeFailureMetadataFilters } from "./useSmokeFailureMetadataFilters";

interface SmokeFailureMetadataManagementProps {
  entries: SmokeFailureMetadataEntry[];
  timezone?: string;
  workflowUrl: string;
}

export function SmokeFailureMetadataManagement({
  entries,
  timezone,
  workflowUrl,
}: SmokeFailureMetadataManagementProps) {
  const cleanup = useCleanupSmokeFailureMetadata();
  const {
    applyFilters,
    changeDateRange,
    changeEndDate,
    changePeriodFilter,
    changeStartDate,
    changeSort,
    changeTypeFilter,
    endDate,
    periodFilter,
    sort,
    startDate,
    typeFilter,
  } = useSmokeFailureMetadataFilters();
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");
  const [cleanupPreviewOpen, setCleanupPreviewOpen] = useState(false);
  const activeStartDate = periodFilter === "custom" ? startDate : "";
  const activeEndDate = periodFilter === "custom" ? endDate : "";
  const visibleEntries = sortSmokeFailureMetadata(
    filterSmokeFailureMetadata(entries, typeFilter, periodFilter, {
      endDate: activeEndDate,
      startDate: activeStartDate,
      timezone,
    }),
    sort,
  );
  const selectedEntries = entries.filter((entry) => selectedRunIds.has(entry.run_id));
  const visibleSelectedCount = visibleEntries.filter((entry) =>
    selectedRunIds.has(entry.run_id),
  ).length;
  const hiddenSelectedCount = selectedEntries.length - visibleSelectedCount;
  const allVisibleSelected =
    visibleEntries.length > 0 &&
    visibleEntries.every((entry) => selectedRunIds.has(entry.run_id));

  const toggleRun = (runId: number) => {
    setSelectedRunIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const updateSelection = (
    targetEntries: SmokeFailureMetadataEntry[],
    selected: boolean,
    message: string,
  ) => {
    setSelectedRunIds((current) =>
      updateSmokeFailureMetadataSelection(current, targetEntries, selected),
    );
    setNotice(message);
  };

  const handleCleanup = async () => {
    const runIds = selectedEntries.map((entry) => entry.run_id);
    if (!runIds.length) return;
    setNotice("");
    try {
      const result = await cleanup.mutateAsync(runIds);
      setSelectedRunIds(new Set());
      setCleanupPreviewOpen(false);
      setNotice(`${result.deleted_count}건을 정리했습니다.`);
    } catch {
      setCleanupPreviewOpen(false);
      setNotice("선택한 실패 분류 정보를 정리하지 못했습니다.");
    }
  };

  return (
    <details
      className="mt-3 rounded-md border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
      data-testid="smoke-failure-metadata-management"
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        실패 분류 정보 관리 {entries.length}건
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실패 유형
          <select
            aria-label="실패 분류 정보 유형 필터"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-testid="smoke-failure-metadata-type-filter"
            onChange={(event) =>
              changeTypeFilter(event.target.value as SmokeFailureMetadataTypeFilter)
            }
            value={typeFilter}
          >
            <option value="all">전체 유형</option>
            <option value="login">로그인</option>
            <option value="external_api">외부 API</option>
            <option value="visual_regression">화면 회귀</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          기록 기간
          <select
            aria-label="실패 분류 정보 기간 필터"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-testid="smoke-failure-metadata-period-filter"
            onChange={(event) =>
              changePeriodFilter(event.target.value as SmokeFailureMetadataPeriodFilter)
            }
            value={periodFilter}
          >
            <option value="all">전체 기간</option>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="custom">사용자 지정</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          정렬
          <select
            aria-label="실패 분류 정보 정렬"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-testid="smoke-failure-metadata-sort"
            onChange={(event) => changeSort(event.target.value as SmokeFailureMetadataSort)}
            value={sort}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="run_desc">실행 번호 높은순</option>
            <option value="run_asc">실행 번호 낮은순</option>
          </select>
        </label>
        <span
          aria-live="polite"
          className="text-xs text-gray-500 dark:text-slate-400"
          data-testid="smoke-failure-metadata-result-count"
        >
          조회 {visibleEntries.length}/{entries.length}건
        </span>
      </div>
      <SmokeFailureMetadataDateFilters
        endDate={endDate}
        onEndDateChange={changeEndDate}
        onRangeChange={changeDateRange}
        onStartDateChange={changeStartDate}
        period={periodFilter}
        startDate={startDate}
        timezone={timezone}
      />
      <SmokeFailureMetadataSavedFilters
        filters={{ endDate, period: periodFilter, sort, startDate, type: typeFilter }}
        onApply={applyFilters}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          aria-label={`현재 필터 결과 JSON ${visibleEntries.length}건 내보내기`}
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-export"
          disabled={!visibleEntries.length}
          onClick={() =>
            downloadSmokeFailureMetadata(visibleEntries, {
              filters: {
                end_date: activeEndDate,
                period: periodFilter,
                start_date: activeStartDate,
                type: typeFilter,
              },
              format: "json",
              scope: "filtered",
              timezone,
            })
          }
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 현재 JSON ({visibleEntries.length})
        </button>
        <button
          aria-label={`현재 필터 결과 CSV ${visibleEntries.length}건 내보내기`}
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-filtered-csv"
          disabled={!visibleEntries.length}
          onClick={() =>
            downloadSmokeFailureMetadata(visibleEntries, {
              filters: {
                end_date: activeEndDate,
                period: periodFilter,
                start_date: activeStartDate,
                type: typeFilter,
              },
              format: "csv",
              scope: "filtered",
              timezone,
            })
          }
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 현재 CSV ({visibleEntries.length})
        </button>
        <button
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-selected-export"
          disabled={!selectedEntries.length}
          onClick={() =>
            downloadSmokeFailureMetadata(selectedEntries, {
              format: "json",
              scope: "selected",
              timezone,
            })
          }
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 선택 JSON ({selectedEntries.length})
        </button>
        <button
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-selected-csv"
          disabled={!selectedEntries.length}
          onClick={() =>
            downloadSmokeFailureMetadata(selectedEntries, {
              format: "csv",
              scope: "selected",
              timezone,
            })
          }
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 선택 CSV ({selectedEntries.length})
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          data-testid="smoke-failure-metadata-cleanup"
          disabled={!selectedEntries.length || cleanup.isPending}
          onClick={() => setCleanupPreviewOpen(true)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {cleanup.isPending ? "정리 중" : `선택 정리 (${selectedEntries.length})`}
        </button>
      </div>
      <SmokeFailureMetadataBulkSelection
        allEntryCount={entries.length}
        hiddenSelectedCount={hiddenSelectedCount}
        onClearAll={() => {
          setSelectedRunIds(new Set());
          setNotice("선택을 모두 해제했습니다.");
        }}
        onClearVisible={() =>
          updateSelection(
            visibleEntries,
            false,
            `현재 결과에서 ${visibleSelectedCount}건을 해제했습니다.`,
          )
        }
        onSelectAll={() =>
          updateSelection(entries, true, `전체 기록 ${entries.length}건을 선택했습니다.`)
        }
        onSelectVisible={() =>
          updateSelection(
            visibleEntries,
            true,
            `현재 결과 ${visibleEntries.length}건을 선택했습니다.`,
          )
        }
        selectedCount={selectedEntries.length}
        visibleCount={visibleEntries.length}
        visibleSelectedCount={visibleSelectedCount}
      />
      {notice ? (
        <p
          aria-live="polite"
          className="mt-1.5 text-xs text-gray-500 dark:text-slate-400"
          data-testid="smoke-failure-metadata-notice"
        >
          {notice}
        </p>
      ) : null}
      {visibleEntries.length ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950">
            <input
              aria-label="현재 실패 정보 결과 전체 선택 또는 해제"
              checked={allVisibleSelected}
              onChange={() =>
                updateSelection(
                  visibleEntries,
                  !allVisibleSelected,
                  allVisibleSelected
                    ? `현재 결과 ${visibleEntries.length}건을 해제했습니다.`
                    : `현재 결과 ${visibleEntries.length}건을 선택했습니다.`,
                )
              }
              ref={(element) => {
                if (element) {
                  element.indeterminate =
                    visibleSelectedCount > 0 && !allVisibleSelected;
                }
              }}
              type="checkbox"
            />
            현재 결과 {visibleSelectedCount}/{visibleEntries.length}건 선택
          </label>
          <ol className="divide-y divide-gray-100 dark:divide-slate-800">
            {visibleEntries.map((entry) => (
              <li className="flex items-start gap-2 px-3 py-2 text-xs" key={entry.run_id}>
                <input
                  aria-label={`실행 #${entry.run_id} 선택`}
                  checked={selectedRunIds.has(entry.run_id)}
                  className="mt-0.5"
                  onChange={() => toggleRun(entry.run_id)}
                  type="checkbox"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-800 dark:text-slate-200">
                    <a
                      className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                      data-testid="smoke-failure-metadata-run-link"
                      href={githubActionsRunUrl(workflowUrl, entry.run_id)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      실행 #{entry.run_id}
                    </a>
                    {` · ${SMOKE_FAILURE_TYPE_LABELS[entry.failure_type]}`}
                  </span>
                  <span className="block break-words text-gray-600 dark:text-slate-300">
                    {entry.check_name}
                  </span>
                  <span className="block text-gray-500 dark:text-slate-400">
                    {formatDateTime(entry.captured_at, timezone)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          {entries.length
            ? "선택한 필터에 맞는 실패 분류 정보가 없습니다."
            : "보관된 실패 분류 정보가 없습니다."}
        </p>
      )}
      <SmokeFailureMetadataCleanupPreview
        entries={selectedEntries}
        hiddenSelectedCount={hiddenSelectedCount}
        isOpen={cleanupPreviewOpen}
        isPending={cleanup.isPending}
        onCancel={() => setCleanupPreviewOpen(false)}
        onConfirm={() => void handleCleanup()}
        timezone={timezone}
        workflowUrl={workflowUrl}
      />
    </details>
  );
}

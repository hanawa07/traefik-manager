"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";

import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import { useCleanupSmokeFailureMetadata } from "@/features/settings/hooks/useSettings";
import { downloadSmokeFailureMetadata } from "@/features/settings/lib/smokeFailureMetadataExport";
import {
  filterSmokeFailureMetadata,
  type SmokeFailureMetadataPeriodFilter,
  type SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";
import { githubActionsRunUrl } from "@/features/settings/lib/smokeGithubUrls";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const FAILURE_TYPE_LABELS = {
  external_api: "외부 API",
  login: "로그인",
  visual_regression: "화면 회귀",
} as const;

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
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState<SmokeFailureMetadataTypeFilter>("all");
  const [periodFilter, setPeriodFilter] =
    useState<SmokeFailureMetadataPeriodFilter>("all");
  const [notice, setNotice] = useState("");
  const visibleEntries = filterSmokeFailureMetadata(entries, typeFilter, periodFilter);
  const selectedEntries = entries.filter((entry) => selectedRunIds.has(entry.run_id));
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

  const handleCleanup = async () => {
    const runIds = selectedEntries.map((entry) => entry.run_id);
    if (
      !runIds.length ||
      !window.confirm(
        `선택한 실패 분류 정보 ${runIds.length}건을 삭제할까요? 삭제 후 복구할 수 없습니다.`,
      )
    ) {
      return;
    }
    setNotice("");
    try {
      const result = await cleanup.mutateAsync(runIds);
      setSelectedRunIds(new Set());
      setNotice(`${result.deleted_count}건을 정리했습니다.`);
    } catch {
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
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          실패 유형
          <select
            aria-label="실패 분류 정보 유형 필터"
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-testid="smoke-failure-metadata-type-filter"
            onChange={(event) =>
              setTypeFilter(event.target.value as SmokeFailureMetadataTypeFilter)
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
              setPeriodFilter(event.target.value as SmokeFailureMetadataPeriodFilter)
            }
            value={periodFilter}
          >
            <option value="all">전체 기간</option>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-export"
          disabled={!entries.length}
          onClick={() => downloadSmokeFailureMetadata(entries, timezone)}
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 전체 JSON
        </button>
        <button
          className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-selected-export"
          disabled={!selectedEntries.length}
          onClick={() =>
            downloadSmokeFailureMetadata(selectedEntries, timezone, "selected")
          }
          type="button"
        >
          <Download className="h-3.5 w-3.5" /> 선택 JSON ({selectedEntries.length})
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          data-testid="smoke-failure-metadata-cleanup"
          disabled={!selectedEntries.length || cleanup.isPending}
          onClick={() => void handleCleanup()}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {cleanup.isPending ? "정리 중" : `선택 정리 (${selectedEntries.length})`}
        </button>
        <span
          aria-live="polite"
          className="text-xs text-gray-500 dark:text-slate-400"
        >
          {notice}
        </span>
      </div>
      {visibleEntries.length ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950">
            <input
              checked={allVisibleSelected}
              onChange={() => {
                setSelectedRunIds((current) => {
                  const next = new Set(current);
                  for (const entry of visibleEntries) {
                    if (allVisibleSelected) next.delete(entry.run_id);
                    else next.add(entry.run_id);
                  }
                  return next;
                });
              }}
              type="checkbox"
            />
            현재 결과 전체 선택
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
                    {` · ${FAILURE_TYPE_LABELS[entry.failure_type]}`}
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
    </details>
  );
}

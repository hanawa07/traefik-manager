"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import type { SmokeFailureMetadataFilters } from "@/features/settings/lib/smokeFailureMetadataFilters";
import { SMOKE_FAILURE_TYPE_LABELS } from "@/features/settings/lib/smokeFailureMetadataLabels";
import {
  mergeSmokeFailureMetadataSavedFilters,
  type SmokeFailureMetadataSavedFilter,
  type SmokeFailureMetadataSavedFiltersBackup,
} from "@/features/settings/lib/smokeFailureMetadataSavedFilters";

export type SmokeFailureMetadataSavedFilterRestoreMode = "merge" | "replace";

interface SmokeFailureMetadataSavedFilterRestorePreviewProps {
  backup: SmokeFailureMetadataSavedFiltersBackup;
  current: SmokeFailureMetadataSavedFilter[];
  filename: string;
  onCancel: () => void;
  onRestore: (mode: SmokeFailureMetadataSavedFilterRestoreMode) => void;
}

const SORT_LABELS = {
  name_asc: "이름 오름차순",
  name_desc: "이름 내림차순",
  recent: "최근 저장순",
} as const;

const FILTER_SORT_LABELS = {
  newest: "최신순",
  oldest: "오래된순",
  run_asc: "실행 번호 낮은순",
  run_desc: "실행 번호 높은순",
} as const;

export function SmokeFailureMetadataSavedFilterRestorePreview({
  backup,
  current,
  filename,
  onCancel,
  onRestore,
}: SmokeFailureMetadataSavedFilterRestorePreviewProps) {
  const [mode, setMode] = useState<SmokeFailureMetadataSavedFilterRestoreMode>(
    backup.filters.length === 1 ? "merge" : "replace",
  );
  const currentNames = new Set(current.map((item) => item.name.toLowerCase()));
  const duplicateCount = backup.filters.filter((item) =>
    currentNames.has(item.name.toLowerCase()),
  ).length;
  const merged = mergeSmokeFailureMetadataSavedFilters(current, backup.filters);
  const omitted = mode === "merge" ? merged.omitted : [];
  const resultCount = mode === "merge" ? merged.filters.length : backup.filters.length;

  return (
    <section
      className="mt-2 rounded-md border border-cyan-200 bg-cyan-50/70 p-2.5 dark:border-cyan-900 dark:bg-cyan-950/30"
      data-testid="smoke-failure-metadata-saved-filter-restore-preview"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-gray-800 dark:text-slate-100">
            복원 미리보기
          </h4>
          <p className="mt-0.5 break-all text-[11px] text-gray-500 dark:text-slate-400">
            {filename}
          </p>
        </div>
        <p
          className="text-[11px] font-medium text-cyan-800 dark:text-cyan-200"
          data-testid="smoke-failure-metadata-saved-filter-restore-sort"
        >
          백업 정렬: {SORT_LABELS[backup.sort]}
        </p>
      </div>
      <p
        className="mt-2 text-xs text-gray-700 dark:text-slate-200"
        data-testid="smoke-failure-metadata-saved-filter-restore-summary"
      >
        백업 {backup.filters.length}개 · 현재 {current.length}개 · 같은 이름 {duplicateCount}개 ·
        결과 {resultCount}개{omitted.length ? ` · 제외 ${omitted.length}개` : ""}
      </p>
      <ul
        className="mt-2 max-h-52 space-y-1 overflow-y-auto"
        data-testid="smoke-failure-metadata-saved-filter-restore-names"
      >
        {backup.filters.length ? backup.filters.map((item) => (
          <li
            className="rounded border border-cyan-100 bg-white/80 px-2 py-1.5 dark:border-cyan-950 dark:bg-slate-950/70"
            data-filter-name={item.name}
            key={item.name}
          >
            <p className="text-[11px] font-medium text-gray-700 dark:text-slate-200">
              {item.name}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">
              {formatFilterConditions(item.filters)}
            </p>
          </li>
        )) : (
          <li className="text-[11px] text-gray-500 dark:text-slate-400">백업 항목 없음</li>
        )}
      </ul>
      <fieldset className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-slate-200">
        <legend className="sr-only">복원 방식</legend>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            checked={mode === "replace"}
            data-testid="smoke-failure-metadata-saved-filter-restore-mode-replace"
            name="smoke-failure-metadata-restore-mode"
            onChange={() => setMode("replace")}
            type="radio"
          />
          교체
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            checked={mode === "merge"}
            data-testid="smoke-failure-metadata-saved-filter-restore-mode-merge"
            name="smoke-failure-metadata-restore-mode"
            onChange={() => setMode("merge")}
            type="radio"
          />
          병합
        </label>
      </fieldset>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
        {mode === "merge"
          ? "같은 이름은 백업 값으로 갱신하고 현재 목록의 나머지는 유지합니다."
          : "현재 목록을 백업 목록으로 교체합니다."}
      </p>
      {omitted.length ? (
        <p
          className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          data-testid="smoke-failure-metadata-saved-filter-restore-omitted"
          role="alert"
        >
          20개 제한으로 제외: {omitted.map((item) => item.name).join(", ")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-restore-execute"
          onClick={() => onRestore(mode)}
          type="button"
        >
          <Check className="h-3.5 w-3.5" /> 복원 실행
        </button>
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs"
          data-testid="smoke-failure-metadata-saved-filter-restore-cancel"
          onClick={onCancel}
          type="button"
        >
          <X className="h-3.5 w-3.5" /> 취소
        </button>
      </div>
    </section>
  );
}

function formatFilterConditions(filters: SmokeFailureMetadataFilters): string {
  const type = filters.type === "all" ? "전체" : SMOKE_FAILURE_TYPE_LABELS[filters.type];
  const period = filters.period === "all"
    ? "전체"
    : filters.period === "7"
      ? "최근 7일"
      : filters.period === "30"
        ? "최근 30일"
        : `${filters.startDate || "시작 없음"} ~ ${filters.endDate || "종료 없음"}`;
  const query = filters.query.trim() || (filters.query ? "공백" : "없음");
  return `유형: ${type} · 기간: ${period} · 검색: ${query} · 정렬: ${FILTER_SORT_LABELS[filters.sort]}`;
}

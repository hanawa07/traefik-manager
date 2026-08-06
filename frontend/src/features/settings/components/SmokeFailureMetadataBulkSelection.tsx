"use client";

import { CheckCheck, ListChecks, MinusSquare, X } from "lucide-react";

interface SmokeFailureMetadataBulkSelectionProps {
  allEntryCount: number;
  hiddenSelectedCount: number;
  onClearAll: () => void;
  onClearVisible: () => void;
  onSelectAll: () => void;
  onSelectVisible: () => void;
  selectedCount: number;
  visibleCount: number;
  visibleSelectedCount: number;
}

const ACTION_CLASS =
  "btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs";

export function SmokeFailureMetadataBulkSelection({
  allEntryCount,
  hiddenSelectedCount,
  onClearAll,
  onClearVisible,
  onSelectAll,
  onSelectVisible,
  selectedCount,
  visibleCount,
  visibleSelectedCount,
}: SmokeFailureMetadataBulkSelectionProps) {
  return (
    <div
      className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950/60"
      data-testid="smoke-failure-metadata-bulk-selection"
    >
      <span
        aria-live="polite"
        className={
          hiddenSelectedCount
            ? "text-xs font-medium text-amber-700 dark:text-amber-300"
            : "text-xs text-gray-600 dark:text-slate-300"
        }
        data-hidden-count={hiddenSelectedCount}
        data-testid="smoke-failure-metadata-selection-summary"
      >
        {selectedCount
          ? `선택 ${selectedCount}건 · 현재 결과 ${visibleSelectedCount}건 · 숨김 ${hiddenSelectedCount}건`
          : "선택 없음"}
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          className={ACTION_CLASS}
          data-testid="smoke-failure-metadata-select-visible"
          disabled={!visibleCount || visibleSelectedCount === visibleCount}
          onClick={onSelectVisible}
          type="button"
        >
          <CheckCheck className="h-3.5 w-3.5" /> 현재 결과 선택 ({visibleCount})
        </button>
        <button
          className={ACTION_CLASS}
          data-testid="smoke-failure-metadata-clear-visible"
          disabled={!visibleSelectedCount}
          onClick={onClearVisible}
          type="button"
        >
          <MinusSquare className="h-3.5 w-3.5" /> 현재 결과 해제 ({visibleSelectedCount})
        </button>
        <button
          className={ACTION_CLASS}
          data-testid="smoke-failure-metadata-select-all"
          disabled={!allEntryCount || selectedCount === allEntryCount}
          onClick={onSelectAll}
          type="button"
        >
          <ListChecks className="h-3.5 w-3.5" /> 전체 기록 선택 ({allEntryCount})
        </button>
        <button
          className={ACTION_CLASS}
          data-testid="smoke-failure-metadata-clear-selection"
          disabled={!selectedCount}
          onClick={onClearAll}
          type="button"
        >
          <X className="h-3.5 w-3.5" /> 전체 해제
        </button>
      </div>
    </div>
  );
}

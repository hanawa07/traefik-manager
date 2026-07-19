import { CheckSquare2, RotateCcw } from "lucide-react";

import type { RoutingMode } from "@/features/services/api/serviceApi";

export default function ServiceBulkRoutingActions({
  allVisibleSelected,
  isPending,
  failureNames,
  onApply,
  onClear,
  onRetry,
  onRoutingModeChange,
  onToggleVisible,
  routingMode,
  selectedCount,
  visibleCount,
}: {
  allVisibleSelected: boolean;
  isPending: boolean;
  failureNames: string[];
  onApply: () => void;
  onClear: () => void;
  onRetry: () => void;
  onRoutingModeChange: (mode: RoutingMode) => void;
  onToggleVisible: () => void;
  routingMode: RoutingMode;
  selectedCount: number;
  visibleCount: number;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            선택한 서비스 {selectedCount}개
          </p>
          <button
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:text-slate-400 dark:text-blue-300"
            disabled={visibleCount === 0 || isPending}
            onClick={onToggleVisible}
            type="button"
          >
            <CheckSquare2 className="h-3.5 w-3.5" />
            {allVisibleSelected ? "현재 결과 선택 해제" : `현재 결과 ${visibleCount}개 전체 선택`}
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="일괄 적용할 운영 상태"
            className="input min-w-44 py-2"
            disabled={isPending}
            onChange={(event) => onRoutingModeChange(event.target.value as RoutingMode)}
            value={routingMode}
          >
            <option value="active">정상 운영</option>
            <option value="disabled">라우팅 비활성</option>
            <option value="maintenance">점검 안내</option>
          </select>
          <button
            className="btn-primary min-w-24 px-4 py-2 text-sm"
            disabled={selectedCount === 0 || isPending}
            onClick={onApply}
            type="button"
          >
            {isPending ? "적용 중" : "선택 적용"}
          </button>
          {selectedCount > 0 ? (
            <button
              className="btn-secondary px-3 py-2 text-sm"
              disabled={isPending}
              onClick={onClear}
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              선택 해제
            </button>
          ) : null}
        </div>
      </div>
      {failureNames.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-950/30 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div>
            <p className="font-semibold text-rose-800 dark:text-rose-200">적용 실패 {failureNames.length}개</p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{failureNames.join(", ")}</p>
          </div>
          <button className="btn-secondary shrink-0 px-3 py-2 text-sm" disabled={isPending} onClick={onRetry} type="button">
            실패 항목 재시도
          </button>
        </div>
      ) : null}
    </section>
  );
}

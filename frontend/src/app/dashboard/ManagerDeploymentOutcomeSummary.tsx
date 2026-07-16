import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import type { ManagerDeploymentHistoryStatusFilter } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentOutcomeSummary({
  currentSourceCount,
  entries,
  onStatusChange,
  selectedStatus,
}: {
  currentSourceCount?: number;
  entries: ManagerDeploymentHistoryEntry[];
  onStatusChange: (status: ManagerDeploymentHistoryStatusFilter) => void;
  selectedStatus: ManagerDeploymentHistoryStatusFilter;
}) {
  if (entries.length === 0) {
    return (
      <p
        className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        data-deployment-outcome-summary="empty"
      >
        선택 기간에 요약할 배포가 없습니다.
      </p>
    );
  }

  const successCount = entries.filter((entry) => entry.status === "success").length;
  const rollbackCount = entries.filter(
    (entry) => entry.status === "rolled_back" || entry.status === "rollback_failed",
  ).length;
  const successRate = percentage(successCount, entries.length);
  const rollbackRate = percentage(rollbackCount, entries.length);

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-900"
      data-deployment-outcome-summary={entries.length}
    >
      <span className="font-semibold text-gray-600 dark:text-slate-300">
        선택 기간 {entries.length}건
      </span>
      {currentSourceCount !== undefined ? (
        <span
          className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
          data-deployment-archive-count={entries.length - currentSourceCount}
          data-deployment-current-count={currentSourceCount}
          data-deployment-source-counts
        >
          현재 {currentSourceCount} · 보관 {entries.length - currentSourceCount}
        </span>
      ) : null}
      <button
        aria-pressed={selectedStatus === "success"}
        className={`rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25 ${
          selectedStatus === "success" ? "ring-2 ring-emerald-500/50" : ""
        }`}
        data-deployment-rate-filter="success"
        data-deployment-success-rate={successRate}
        onClick={() => onStatusChange(selectedStatus === "success" ? "all" : "success")}
        type="button"
      >
        성공률 {successRate}% ({successCount}/{entries.length})
      </button>
      <button
        aria-pressed={selectedStatus === "rollback"}
        className={`rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/25 ${
          selectedStatus === "rollback" ? "ring-2 ring-amber-500/50" : ""
        }`}
        data-deployment-rate-filter="rollback"
        data-deployment-rollback-rate={rollbackRate}
        onClick={() => onStatusChange(selectedStatus === "rollback" ? "all" : "rollback")}
        title="자동 롤백과 롤백 실패를 포함합니다."
        type="button"
      >
        롤백률 {rollbackRate}% ({rollbackCount}/{entries.length})
      </button>
      <details className="basis-full text-gray-500 dark:text-slate-400" data-deployment-rate-help>
        <summary className="w-fit cursor-pointer font-semibold text-gray-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-200">
          산정 기준
        </summary>
        <p className="mt-1 leading-relaxed">
          선택한 소스와 기간·날짜의 전체 배포가 분모입니다. 성공률은 success, 롤백률은
          rolled_back·rollback_failed 상태를 집계하며 상태·실패 단계·검색 필터는 비율에
          반영하지 않습니다.
        </p>
      </details>
    </div>
  );
}

function percentage(count: number, total: number): number {
  return Math.round((count / total) * 100);
}

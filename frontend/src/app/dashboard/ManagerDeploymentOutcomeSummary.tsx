import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import type { ManagerDeploymentHistoryStatusFilter } from "./managerDeploymentHistoryQuery";

export function ManagerDeploymentOutcomeSummary({
  entries,
  onStatusChange,
  selectedStatus,
}: {
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
    </div>
  );
}

function percentage(count: number, total: number): number {
  return Math.round((count / total) * 100);
}

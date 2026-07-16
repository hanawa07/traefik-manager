import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import {
  formatManagerDeploymentDurationMs,
  getManagerDeploymentDurationMs,
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
} from "./managerDeploymentHistoryDisplay";
import type {
  ManagerDeploymentHistoryFailureStage,
  ManagerDeploymentHistoryStageFilter,
} from "./managerDeploymentHistoryQuery";

interface ManagerDeploymentFailureSummaryProps {
  entries: ManagerDeploymentHistoryEntry[];
  onStageChange: (stage: ManagerDeploymentHistoryStageFilter) => void;
  selectedStage: ManagerDeploymentHistoryStageFilter;
}

export function ManagerDeploymentFailureSummary({
  entries,
  onStageChange,
  selectedStage,
}: ManagerDeploymentFailureSummaryProps) {
  const failedEntries = entries.filter((entry) => entry.status !== "success");
  if (failedEntries.length === 0) return null;

  const stageGroups = (
    Object.keys(MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS) as ManagerDeploymentHistoryFailureStage[]
  )
    .map((stage) => ({
      entries: failedEntries.filter((entry) => entry.failure_stage === stage),
      label: MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[stage],
      stage,
    }))
    .filter(({ entries: stageEntries }) => stageEntries.length > 0);
  const unknownEntries = failedEntries.filter((entry) => !entry.failure_stage);

  return (
    <div
      aria-label="배포 실패 단계 필터"
      className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      data-deployment-failure-stats
      role="group"
    >
      <span className="font-semibold">실패 {failedEntries.length}건</span>
      <FailureStageButton
        active={selectedStage === "all"}
        label="단계 전체"
        onClick={() => onStageChange("all")}
        stage="all"
      />
      {stageGroups.map(({ entries: stageEntries, label, stage }) => (
        <FailureStageButton
          active={selectedStage === stage}
          average={formatAverageDuration(stageEntries)}
          count={stageEntries.length}
          key={stage}
          label={label}
          onClick={() => onStageChange(selectedStage === stage ? "all" : stage)}
          stage={stage}
        />
      ))}
      {unknownEntries.length > 0 ? (
        <FailureStageButton
          active={selectedStage === "unknown"}
          average={formatAverageDuration(unknownEntries)}
          count={unknownEntries.length}
          label="단계 미기록"
          onClick={() => onStageChange(selectedStage === "unknown" ? "all" : "unknown")}
          stage="unknown"
        />
      ) : null}
    </div>
  );
}

function FailureStageButton({
  active,
  average,
  count,
  label,
  onClick,
  stage,
}: {
  active: boolean;
  average?: string;
  count?: number;
  label: string;
  onClick: () => void;
  stage: ManagerDeploymentHistoryStageFilter;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
        active
          ? "bg-amber-700 text-white dark:bg-amber-300 dark:text-slate-950"
          : "bg-white/80 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
      }`}
      data-failure-stage-average={average ? stage : undefined}
      data-failure-stage-filter={stage}
      onClick={onClick}
      type="button"
    >
      {label}{count === undefined ? "" : ` ${count}`}{average ? ` · 평균 ${average}` : ""}
    </button>
  );
}

function formatAverageDuration(entries: ManagerDeploymentHistoryEntry[]): string {
  const durations = entries
    .map((entry) => getManagerDeploymentDurationMs(entry.started_at, entry.completed_at))
    .filter((duration): duration is number => duration !== null);
  if (durations.length === 0) return "확인 불가";
  const average = durations.reduce((total, duration) => total + duration, 0) / durations.length;
  return formatManagerDeploymentDurationMs(Math.round(average));
}

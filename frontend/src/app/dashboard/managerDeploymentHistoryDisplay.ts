import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

import type {
  ManagerDeploymentHistoryFailureStage,
  ManagerDeploymentHistoryPeriodFilter,
  ManagerDeploymentHistoryStatusFilter,
} from "./managerDeploymentHistoryQuery";

export const MANAGER_DEPLOYMENT_STATUS_DISPLAY = {
  success: {
    label: "전환 완료",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  failed_before_switch: {
    label: "전환 전 중단",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rolled_back: {
    label: "자동 롤백",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
  },
  rollback_failed: {
    label: "롤백 실패",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  },
} as const satisfies Record<
  ManagerDeploymentHistoryEntry["status"],
  { className: string; label: string }
>;

export const MANAGER_DEPLOYMENT_FILTER_OPTIONS: readonly {
  value: ManagerDeploymentHistoryStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "success", label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.success.label },
  {
    value: "failed_before_switch",
    label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.failed_before_switch.label,
  },
  { value: "rolled_back", label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.rolled_back.label },
  {
    value: "rollback_failed",
    label: MANAGER_DEPLOYMENT_STATUS_DISPLAY.rollback_failed.label,
  },
];

export const MANAGER_DEPLOYMENT_PERIOD_OPTIONS: readonly {
  label: string;
  value: ManagerDeploymentHistoryPeriodFilter;
}[] = [
  { value: "all", label: "전체 기간" },
  { value: "1", label: "최근 24시간" },
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
  { value: "90", label: "최근 90일" },
];

export const MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS: Record<
  ManagerDeploymentHistoryFailureStage,
  string
> = {
  prepare: "사전 준비",
  build: "이미지 빌드",
  migration_preflight: "DB migration 사전 검사",
  candidate_health: "후보 컨테이너 준비",
  route_switch: "Traefik route 전환",
  leader_handover: "background leader 승계",
  public_probe: "공개 health probe",
  state_write: "배포 상태 확정",
};

export function formatManagerDeploymentDuration(startedAt: string, completedAt: string): string {
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(durationMs) || durationMs < 0) return "확인 불가";
  if (durationMs < 1_000) return "1초 미만";

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""}`;
  if (minutes > 0) return `${minutes}분${seconds > 0 ? ` ${seconds}초` : ""}`;
  return `${seconds}초`;
}

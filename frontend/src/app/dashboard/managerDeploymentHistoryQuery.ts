import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

export type ManagerDeploymentHistoryStatusFilter = "all" | ManagerDeploymentHistoryEntry["status"];
export type ManagerDeploymentHistoryFailureStage = NonNullable<ManagerDeploymentHistoryEntry["failure_stage"]>;
export type ManagerDeploymentHistoryStageFilter = "all" | "unknown" | ManagerDeploymentHistoryFailureStage;
export type ManagerDeploymentHistorySourceFilter = "archive" | "current";

export const MANAGER_DEPLOYMENT_HISTORY_QUERY = {
  search: "deployment_q",
  source: "deployment_source",
  stage: "deployment_stage",
  status: "deployment_status",
} as const;

const STATUS_FILTERS: readonly ManagerDeploymentHistoryStatusFilter[] = [
  "all",
  "success",
  "failed_before_switch",
  "rolled_back",
  "rollback_failed",
];

const STAGE_FILTERS: readonly ManagerDeploymentHistoryStageFilter[] = [
  "all",
  "unknown",
  "prepare",
  "build",
  "migration_preflight",
  "candidate_health",
  "route_switch",
  "leader_handover",
  "public_probe",
  "state_write",
];

export function parseManagerDeploymentHistoryStatus(
  value: string | null,
): ManagerDeploymentHistoryStatusFilter {
  return STATUS_FILTERS.includes(value as ManagerDeploymentHistoryStatusFilter)
    ? value as ManagerDeploymentHistoryStatusFilter
    : "all";
}

export function parseManagerDeploymentHistoryStage(
  value: string | null,
): ManagerDeploymentHistoryStageFilter {
  return STAGE_FILTERS.includes(value as ManagerDeploymentHistoryStageFilter)
    ? value as ManagerDeploymentHistoryStageFilter
    : "all";
}

export function parseManagerDeploymentHistorySource(
  value: string | null,
): ManagerDeploymentHistorySourceFilter {
  return value === "archive" ? "archive" : "current";
}

export function replaceManagerDeploymentHistoryQueryParams(
  values: [key: string, value: string, defaultValue: string][],
) {
  const url = new URL(window.location.href);
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

import type { SmokeMonitoringRecentRun } from "../api/settingsSmokeRotationApi";

export const LAST_MANUAL_SMOKE_RUN_STORAGE_KEY = "traefik-manager:last-manual-smoke-run";

export interface TrackedManualSmokeRun {
  completed_at: string;
  run_number: number | null;
  run_url: string;
  status: SmokeMonitoringRecentRun["status"];
}

export function findNewSmokeRun(
  runs: readonly SmokeMonitoringRecentRun[],
  knownRunUrls: readonly string[],
) {
  return runs.find((run) => !knownRunUrls.includes(run.run_url)) ?? null;
}

export function getTrackedManualSmokeRun(
  run: Pick<SmokeMonitoringRecentRun, "completed_at" | "run_number" | "run_url" | "status">,
): TrackedManualSmokeRun | null {
  return parseTrackedManualSmokeRun(JSON.stringify(run));
}

export function parseTrackedManualSmokeRun(serialized: string | null): TrackedManualSmokeRun | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    if (
      !value ||
      !["success", "failure", "skipped"].includes(String(value.status)) ||
      typeof value.completed_at !== "string" ||
      !Number.isFinite(Date.parse(value.completed_at)) ||
      typeof value.run_url !== "string" ||
      !isGitHubActionsRunUrl(value.run_url) ||
      (value.run_number !== null &&
        (typeof value.run_number !== "number" ||
          !Number.isInteger(value.run_number) ||
          value.run_number < 1))
    ) {
      return null;
    }
    return {
      completed_at: value.completed_at,
      run_number: value.run_number as number | null,
      run_url: value.run_url,
      status: value.status as TrackedManualSmokeRun["status"],
    };
  } catch {
    return null;
  }
}

function isGitHubActionsRunUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" &&
      /^\/[^/]+\/[^/]+\/actions\/runs\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

import type { SmokeMonitoringRecentRun } from "../api/settingsSmokeRotationApi";

export function findNewSmokeRun(
  runs: readonly SmokeMonitoringRecentRun[],
  knownRunUrls: readonly string[],
) {
  return runs.find((run) => !knownRunUrls.includes(run.run_url)) ?? null;
}

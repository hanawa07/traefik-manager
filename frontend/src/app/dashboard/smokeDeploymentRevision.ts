import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";

export function getSmokeDeploymentRevisionStatus(
  deployedRevision: string | null | undefined,
  runs: SmokeMonitoringRecentRun[],
) {
  const deployed = normalizeSmokeRevision(deployedRevision);
  const run = runs.find(
    (item) => item.status === "success" && normalizeSmokeRevision(item.commit_sha) !== null,
  );
  const smoke = normalizeSmokeRevision(run?.commit_sha);
  if (!deployed || !run || !smoke) return null;
  return {
    deployedRevision: deployed,
    matches: deployed.startsWith(smoke) || smoke.startsWith(deployed),
    run,
    smokeRevision: smoke,
  };
}

export function normalizeSmokeRevision(value: string | null | undefined): string | null {
  const revision = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{7,40}$/.test(revision) ? revision : null;
}

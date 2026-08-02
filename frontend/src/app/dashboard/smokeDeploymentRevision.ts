import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";

export function getSmokeDeploymentRevisionStatus(
  deployedRevision: string | null | undefined,
  runs: SmokeMonitoringRecentRun[],
) {
  const deployed = normalizeRevision(deployedRevision);
  const run = runs.find(
    (item) => item.status === "success" && normalizeRevision(item.commit_sha) !== null,
  );
  const smoke = normalizeRevision(run?.commit_sha);
  if (!deployed || !run || !smoke) return null;
  return {
    deployedRevision: deployed,
    matches: deployed.startsWith(smoke) || smoke.startsWith(deployed),
    run,
    smokeRevision: smoke,
  };
}

function normalizeRevision(value: string | null | undefined): string | null {
  const revision = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{7,40}$/.test(revision) ? revision : null;
}

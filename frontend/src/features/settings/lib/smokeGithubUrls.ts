export function githubCommitUrl(runUrl: string, commitSha: string): string {
  return `${runUrl.split("/actions/runs/")[0]}/commit/${encodeURIComponent(commitSha)}`;
}

export function githubActionsRunUrl(workflowUrl: string, runId: number): string {
  const [repositoryUrl] = workflowUrl.split("/actions/workflows/");
  return `${repositoryUrl.replace(/\/+$/, "")}/actions/runs/${runId}`;
}

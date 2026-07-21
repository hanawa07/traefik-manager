export function githubCommitUrl(runUrl: string, commitSha: string): string {
  return `${runUrl.split("/actions/runs/")[0]}/commit/${encodeURIComponent(commitSha)}`;
}

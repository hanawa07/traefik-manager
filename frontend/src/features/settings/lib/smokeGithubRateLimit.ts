const GITHUB_API_REFRESH_RESERVE = 10;

export function isGithubApiRefreshBlocked(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (remaining === null || remaining === undefined || remaining > GITHUB_API_REFRESH_RESERVE) {
    return false;
  }
  const resetTime = Date.parse(resetAt || "");
  return Number.isNaN(resetTime) || resetTime > now;
}

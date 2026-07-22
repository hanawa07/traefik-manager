import { useEffect, useState } from "react";

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

export function useGithubApiRefreshBlocked(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
): boolean {
  const [, setResetTick] = useState(0);

  useEffect(() => {
    if (!isGithubApiRefreshBlocked(remaining, resetAt)) return;
    const resetTime = Date.parse(resetAt || "");
    if (Number.isNaN(resetTime)) return;
    const timer = window.setTimeout(
      () => setResetTick((value) => value + 1),
      Math.max(0, resetTime - Date.now() + 50),
    );
    return () => window.clearTimeout(timer);
  }, [remaining, resetAt]);

  return isGithubApiRefreshBlocked(remaining, resetAt);
}

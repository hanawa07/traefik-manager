import { useEffect, useState } from "react";

const GITHUB_API_DEFAULT_REFRESH_RESERVE = 10;

export function isGithubApiRefreshBlocked(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
  secondaryRetryAt?: string | null,
  refreshReserve = GITHUB_API_DEFAULT_REFRESH_RESERVE,
  now = Date.now(),
): boolean {
  if (isGithubSecondaryRateLimitBlocked(secondaryRetryAt, now)) return true;
  if (remaining === null || remaining === undefined || remaining > refreshReserve) {
    return false;
  }
  const resetTime = Date.parse(resetAt || "");
  return Number.isNaN(resetTime) || resetTime > now;
}

export function useGithubApiRefreshBlocked(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
  secondaryRetryAt?: string | null,
  refreshReserve = GITHUB_API_DEFAULT_REFRESH_RESERVE,
): boolean {
  const [, setResetTick] = useState(0);

  useEffect(() => {
    if (!isGithubApiRefreshBlocked(remaining, resetAt, secondaryRetryAt, refreshReserve)) return;
    const now = Date.now();
    const unblockTimes = [
      remaining !== null && remaining !== undefined && remaining <= refreshReserve
        ? Date.parse(resetAt || "")
        : Number.NaN,
      Date.parse(secondaryRetryAt || ""),
    ].filter((value) => Number.isFinite(value) && value > now);
    if (!unblockTimes.length) return;
    const timer = window.setTimeout(
      () => setResetTick((value) => value + 1),
      Math.max(...unblockTimes) - now + 50,
    );
    return () => window.clearTimeout(timer);
  }, [remaining, refreshReserve, resetAt, secondaryRetryAt]);

  return isGithubApiRefreshBlocked(remaining, resetAt, secondaryRetryAt, refreshReserve);
}

export function isGithubSecondaryRateLimitBlocked(
  retryAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const retryTime = Date.parse(retryAt || "");
  return !Number.isNaN(retryTime) && retryTime > now;
}

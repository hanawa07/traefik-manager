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

export function getGithubApiRefreshRetryAt(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
  secondaryRetryAt?: string | null,
  refreshReserve = GITHUB_API_DEFAULT_REFRESH_RESERVE,
  now = Date.now(),
): string | null {
  const retryCandidates = [
    remaining !== null && remaining !== undefined && remaining <= refreshReserve
      ? resetAt
      : null,
    isGithubSecondaryRateLimitBlocked(secondaryRetryAt, now) ? secondaryRetryAt : null,
  ].filter(
    (value): value is string => typeof value === "string" && Date.parse(value) > now,
  );
  if (!retryCandidates.length) return null;
  return retryCandidates.reduce((latest, candidate) =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest,
  );
}

export function useGithubApiRefreshBlocked(
  remaining: number | null | undefined,
  resetAt: string | null | undefined,
  secondaryRetryAt?: string | null,
  refreshReserve = GITHUB_API_DEFAULT_REFRESH_RESERVE,
): boolean {
  const [, setResetTick] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (!isGithubApiRefreshBlocked(remaining, resetAt, secondaryRetryAt, refreshReserve, now)) {
      return;
    }
    const retryAt = getGithubApiRefreshRetryAt(
      remaining,
      resetAt,
      secondaryRetryAt,
      refreshReserve,
      now,
    );
    if (!retryAt) return;
    const timer = window.setTimeout(
      () => setResetTick((value) => value + 1),
      Date.parse(retryAt) - now + 50,
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

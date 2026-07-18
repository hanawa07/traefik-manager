import type { AuditLogItem } from "../api/auditApi";

type AuditRetryTimingItem = Pick<AuditLogItem, "created_at" | "detail">;

export type AuditRetryRecoveryState = "none" | "pending" | "invalid" | "recovered";
// Allow two 5-minute monitor cycles before treating an automatic retry as delayed.
export const AUTO_RETRY_DELAY_WARNING_MS = 10 * 60 * 1_000;

export function getAuditRetryChainTiming(chain: readonly AuditRetryTimingItem[]) {
  const stageElapsedMs = chain.map((item, index) =>
    index === 0 ? null : getElapsedMs(chain[index - 1].created_at, item.created_at),
  );
  const stageDelayWarnings = chain.map((item, index) => {
    const elapsedMs = stageElapsedMs[index];
    return item.detail?.trigger === "automatic_retry" &&
      elapsedMs !== null && elapsedMs > AUTO_RETRY_DELAY_WARNING_MS;
  });
  const firstFailureIndex = chain.findIndex((item) => item.detail?.success === false);
  const firstFailure = chain[firstFailureIndex];
  const firstSuccess = firstFailureIndex >= 0
    ? chain.slice(firstFailureIndex + 1).find((item) => item.detail?.success === true)
    : undefined;
  const recoveryDurationMs = firstFailure && firstSuccess
    ? getElapsedMs(firstFailure.created_at, firstSuccess.created_at)
    : null;
  const recoveryState: AuditRetryRecoveryState = firstFailureIndex < 0
    ? "none"
    : !firstSuccess
      ? "pending"
      : recoveryDurationMs === null ? "invalid" : "recovered";

  return { recoveryDurationMs, recoveryState, stageDelayWarnings, stageElapsedMs };
}

function getElapsedMs(startedAt: string, completedAt: string) {
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
}

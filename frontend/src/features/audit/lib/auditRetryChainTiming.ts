import type { AuditLogItem } from "../api/auditApi";

type AuditRetryTimingItem = Pick<AuditLogItem, "created_at" | "detail">;

export type AuditRetryRecoveryState = "none" | "pending" | "invalid" | "recovered";

export function getAuditRetryChainTiming(chain: readonly AuditRetryTimingItem[]) {
  const stageElapsedMs = chain.map((item, index) =>
    index === 0 ? null : getElapsedMs(chain[index - 1].created_at, item.created_at),
  );
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

  return { recoveryDurationMs, recoveryState, stageElapsedMs };
}

function getElapsedMs(startedAt: string, completedAt: string) {
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
}

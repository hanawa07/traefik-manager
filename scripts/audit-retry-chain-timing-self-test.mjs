import assert from "node:assert/strict";

import { getAuditRetryChainTiming } from "../frontend/src/features/audit/lib/auditRetryChainTiming.ts";

const recoveredChain = [
  { created_at: "2026-07-19T00:00:00Z", detail: { success: false } },
  { created_at: "2026-07-19T00:00:30Z", detail: { success: false, trigger: "automatic_retry" } },
  { created_at: "2026-07-19T00:02:00Z", detail: { success: true, trigger: "automatic_retry" } },
];

assert.deepEqual(getAuditRetryChainTiming(recoveredChain), {
  recoveryDurationMs: 120_000,
  recoveryState: "recovered",
  stageDelayWarnings: [false, false, false],
  stageElapsedMs: [null, 30_000, 90_000],
});
assert.deepEqual(
  getAuditRetryChainTiming([
    recoveredChain[0],
    { created_at: "2026-07-19T00:10:00Z", detail: { success: false, trigger: "automatic_retry" } },
    { created_at: "2026-07-19T00:20:01Z", detail: { success: false, trigger: "automatic_retry" } },
  ]).stageDelayWarnings,
  [false, false, true],
);
assert.equal(getAuditRetryChainTiming(recoveredChain.slice(0, 2)).recoveryState, "pending");
assert.deepEqual(
  getAuditRetryChainTiming([
    recoveredChain[0],
    { created_at: "invalid", detail: { success: true } },
  ]),
  {
    recoveryDurationMs: null,
    recoveryState: "invalid",
    stageDelayWarnings: [false, false],
    stageElapsedMs: [null, null],
  },
);
assert.equal(
  getAuditRetryChainTiming([{ created_at: recoveredChain[0].created_at, detail: { success: true } }])
    .recoveryState,
  "none",
);

console.log("알림 비발송 재시도 체인 timing fixture self-test 통과");

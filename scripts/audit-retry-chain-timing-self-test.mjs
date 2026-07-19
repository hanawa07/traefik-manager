import assert from "node:assert/strict";

import { getAuditRetryChainTiming } from "../frontend/src/features/audit/lib/auditRetryChainTiming.ts";
import { getAuditSecuritySettingChanges } from "../frontend/src/features/audit/lib/auditSecuritySettingChanges.ts";

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
assert.deepEqual(
  getAuditRetryChainTiming([
    recoveredChain[0],
    { created_at: "2026-07-19T00:10:01Z", detail: { success: false, trigger: "automatic_retry" } },
  ], 15 * 60 * 1_000).stageDelayWarnings,
  [false, false],
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
assert.deepEqual(
  getAuditSecuritySettingChanges("settings_update_security_alert", [
    { key: "automatic_retry_delay_warning_minutes", before: 10, after: 25 },
    { key: "manager_http_server_error_threshold", before: 10, after: 7 },
  ]),
  [
    {
      afterLabel: "25분",
      beforeLabel: "10분",
      deltaLabel: "+15분",
      direction: "up",
      key: "automatic_retry_delay_warning_minutes",
      label: "자동 재시도 지연 임계치",
    },
    {
      afterLabel: "7건",
      beforeLabel: "10건",
      deltaLabel: "-3건",
      direction: "down",
      key: "manager_http_server_error_threshold",
      label: "5xx 경고 임계치",
    },
  ],
);
assert.deepEqual(
  getAuditSecuritySettingChanges("settings_update_login_defense", [
    { key: "suspicious_block_enabled", before: false, after: true },
    { key: "turnstile_mode", before: "off", after: "risk_based" },
  ]),
  [
    {
      afterLabel: "사용",
      beforeLabel: "사용 안 함",
      deltaLabel: null,
      direction: null,
      key: "suspicious_block_enabled",
      label: "의심 IP 자동 차단",
    },
    {
      afterLabel: "위험 기반",
      beforeLabel: "사용 안 함",
      deltaLabel: null,
      direction: null,
      key: "turnstile_mode",
      label: "Turnstile 모드",
    },
  ],
);
assert.deepEqual(
  getAuditSecuritySettingChanges("settings_update_cloudflare", [
    { key: "enabled", before: false, after: true },
  ]),
  [],
);

console.log("알림 재시도 체인과 보안 설정 변경 fixture self-test 통과");

import assert from "node:assert/strict";

import {
  getSmokeFailureMetadataCleanupDetailRows,
} from "../frontend/src/app/dashboard/audit/audit-page-helpers/smokeFailureMetadataCleanupDetailRows.ts";

const rows = getSmokeFailureMetadataCleanupDetailRows("smoke_failure_metadata_cleanup", {
  requested_run_ids: [9, 2, "invalid", 0],
  deleted_count: 2,
  retained_count: 7,
  client_ip: "127.0.0.1",
});

assert.deepEqual(
  rows.map(({ label, value }) => [label, value]),
  [
    ["요청 실행 번호", ["#9", "#2"]],
    ["삭제한 실패 정보", "2건"],
    ["남은 실패 정보", "7건"],
    ["요청 IP", "127.0.0.1"],
  ],
);
assert.deepEqual(getSmokeFailureMetadataCleanupDetailRows("service_update", {}), []);

console.log("스모크 실패 정보 정리 감사 상세 self-test 통과");

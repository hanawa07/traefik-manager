import assert from "node:assert/strict";

import {
  getSmokeFailureClassificationDetailRows,
} from "../frontend/src/app/dashboard/audit/audit-page-helpers/smokeFailureClassificationDetailRows.ts";

const rows = getSmokeFailureClassificationDetailRows("smoke_failure_classified", {
  before_failure_type: null,
  after_failure_type: "external_api",
});

assert.deepEqual(
  rows.map(({ label, value }) => [label, value]),
  [
    ["변경 전 유형", "미분류"],
    ["변경 후 유형", "외부 API"],
  ],
);
assert.deepEqual(getSmokeFailureClassificationDetailRows("service_update", {}), []);

console.log("스모크 실패 수동 분류 감사 상세 self-test 통과");

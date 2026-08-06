import assert from "node:assert/strict";

import { filterSmokeFailureMetadata } from "../frontend/src/features/settings/lib/smokeFailureMetadataFilters.ts";

const now = Date.parse("2026-08-06T00:00:00Z");
const entries = [
  { run_id: 1, failure_type: "login", captured_at: "2026-08-05T00:00:00Z" },
  { run_id: 2, failure_type: "external_api", captured_at: "2026-07-28T00:00:00Z" },
  { run_id: 3, failure_type: "visual_regression", captured_at: "2026-06-01T00:00:00Z" },
  { run_id: 4, failure_type: "login", captured_at: "invalid" },
];

assert.deepEqual(
  filterSmokeFailureMetadata(entries, "login", "all", now).map(({ run_id }) => run_id),
  [1, 4],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "all", "7", now).map(({ run_id }) => run_id),
  [1],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "external_api", "30", now).map(({ run_id }) => run_id),
  [2],
);

console.log("스모크 실패 정보 유형·기간 필터 self-test 통과");

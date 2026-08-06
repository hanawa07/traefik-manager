import assert from "node:assert/strict";

import {
  filterSmokeFailureMetadata,
  parseSmokeFailureMetadataFilters,
  SMOKE_FAILURE_METADATA_QUERY,
} from "../frontend/src/features/settings/lib/smokeFailureMetadataFilters.ts";

const now = Date.parse("2026-08-06T00:00:00Z");
const entries = [
  { run_id: 1, failure_type: "login", captured_at: "2026-08-05T00:00:00Z" },
  { run_id: 2, failure_type: "external_api", captured_at: "2026-07-28T00:00:00Z" },
  { run_id: 3, failure_type: "visual_regression", captured_at: "2026-06-01T00:00:00Z" },
  { run_id: 4, failure_type: "login", captured_at: "invalid" },
];

assert.deepEqual(
  filterSmokeFailureMetadata(entries, "login", "all", { now }).map(({ run_id }) => run_id),
  [1, 4],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "all", "7", { now }).map(({ run_id }) => run_id),
  [1],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "external_api", "30", { now }).map(({ run_id }) => run_id),
  [2],
);
assert.deepEqual(
  filterSmokeFailureMetadata(
    [
      { run_id: 5, failure_type: "login", captured_at: "2026-08-05T15:30:00Z" },
      { run_id: 6, failure_type: "login", captured_at: "2026-08-06T15:30:00Z" },
    ],
    "all",
    "custom",
    { startDate: "2026-08-06", endDate: "2026-08-06", timezone: "Asia/Seoul" },
  ).map(({ run_id }) => run_id),
  [5],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "all", "custom", {
    startDate: "2026-08-07",
    endDate: "2026-08-06",
  }),
  [],
);
assert.deepEqual(
  parseSmokeFailureMetadataFilters(
    `?${SMOKE_FAILURE_METADATA_QUERY.type}=login&${SMOKE_FAILURE_METADATA_QUERY.period}=7`,
  ),
  { endDate: "", period: "7", startDate: "", type: "login" },
);
assert.deepEqual(
  parseSmokeFailureMetadataFilters(
    "?smoke_metadata_period=custom&smoke_metadata_from=2026-08-01&smoke_metadata_to=2026-08-06",
  ),
  { endDate: "2026-08-06", period: "custom", startDate: "2026-08-01", type: "all" },
);
assert.deepEqual(
  parseSmokeFailureMetadataFilters(
    "?smoke_metadata_type=unknown&smoke_metadata_period=custom&smoke_metadata_from=2026-02-30",
  ),
  { endDate: "", period: "custom", startDate: "", type: "all" },
);

console.log("스모크 실패 정보 유형·기간 필터 self-test 통과");

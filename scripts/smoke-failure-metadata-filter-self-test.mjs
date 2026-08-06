import assert from "node:assert/strict";

import {
  buildSmokeFailureMetadataDatePresetRange,
  countSmokeFailureMetadataActiveFilters,
  filterSmokeFailureMetadata,
  parseSmokeFailureMetadataFilters,
  SMOKE_FAILURE_METADATA_QUERY,
  sortSmokeFailureMetadata,
} from "../frontend/src/features/settings/lib/smokeFailureMetadataFilters.ts";

const presetNow = Date.parse("2026-01-01T15:30:00Z");
assert.equal(
  countSmokeFailureMetadataActiveFilters({
    endDate: "",
    period: "all",
    query: "",
    sort: "newest",
    startDate: "",
    type: "all",
  }),
  0,
);
assert.equal(
  countSmokeFailureMetadataActiveFilters({
    endDate: "2026-08-06",
    period: "custom",
    query: "관리자",
    sort: "run_asc",
    startDate: "2026-08-01",
    type: "login",
  }),
  4,
);
assert.deepEqual(
  buildSmokeFailureMetadataDatePresetRange("today", {
    now: presetNow,
    timezone: "Asia/Seoul",
  }),
  { endDate: "2026-01-02", startDate: "2026-01-02" },
);
assert.deepEqual(
  buildSmokeFailureMetadataDatePresetRange("yesterday", {
    now: presetNow,
    timezone: "Asia/Seoul",
  }),
  { endDate: "2026-01-01", startDate: "2026-01-01" },
);
assert.deepEqual(
  buildSmokeFailureMetadataDatePresetRange("this_month", {
    now: presetNow,
    timezone: "Asia/Seoul",
  }),
  { endDate: "2026-01-02", startDate: "2026-01-01" },
);
assert.deepEqual(
  buildSmokeFailureMetadataDatePresetRange("last_month", {
    now: presetNow,
    timezone: "Asia/Seoul",
  }),
  { endDate: "2025-12-31", startDate: "2025-12-01" },
);

const now = Date.parse("2026-08-06T00:00:00Z");
const entries = [
  { run_id: 1, failure_type: "login", captured_at: "2026-08-05T00:00:00Z", check_name: "Login primary" },
  { run_id: 2, failure_type: "external_api", captured_at: "2026-07-28T00:00:00Z", check_name: "External API" },
  { run_id: 3, failure_type: "visual_regression", captured_at: "2026-06-01T00:00:00Z", check_name: "Visual page" },
  { run_id: 4, failure_type: "login", captured_at: "invalid", check_name: "Login fallback" },
];

assert.deepEqual(
  sortSmokeFailureMetadata(entries, "newest").map(({ run_id }) => run_id),
  [1, 2, 3, 4],
);
assert.deepEqual(
  sortSmokeFailureMetadata(entries, "oldest").map(({ run_id }) => run_id),
  [3, 2, 1, 4],
);
assert.deepEqual(
  sortSmokeFailureMetadata(entries, "run_desc").map(({ run_id }) => run_id),
  [4, 3, 2, 1],
);
assert.deepEqual(
  sortSmokeFailureMetadata(entries, "run_asc").map(({ run_id }) => run_id),
  [1, 2, 3, 4],
);
assert.deepEqual(entries.map(({ run_id }) => run_id), [1, 2, 3, 4]);

assert.deepEqual(
  filterSmokeFailureMetadata(entries, "all", "all", { query: "#2" }).map(
    ({ run_id }) => run_id,
  ),
  [2],
);
assert.deepEqual(
  filterSmokeFailureMetadata(entries, "all", "all", { query: "Login" }).map(
    ({ run_id }) => run_id,
  ),
  [1, 4],
);

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
  {
    endDate: "",
    period: "7",
    query: "",
    sort: "newest",
    startDate: "",
    type: "login",
  },
);
assert.deepEqual(
  parseSmokeFailureMetadataFilters(
    "?smoke_metadata_period=custom&smoke_metadata_from=2026-08-01&smoke_metadata_to=2026-08-06",
  ),
  {
    endDate: "2026-08-06",
    period: "custom",
    query: "",
    sort: "newest",
    startDate: "2026-08-01",
    type: "all",
  },
);
assert.deepEqual(
  parseSmokeFailureMetadataFilters(
    "?smoke_metadata_type=unknown&smoke_metadata_period=custom&smoke_metadata_from=2026-02-30",
  ),
  {
    endDate: "",
    period: "custom",
    query: "",
    sort: "newest",
    startDate: "",
    type: "all",
  },
);
assert.equal(
  parseSmokeFailureMetadataFilters("?smoke_metadata_sort=run_asc").sort,
  "run_asc",
);
assert.equal(
  parseSmokeFailureMetadataFilters("?smoke_metadata_q=%23987").query,
  "#987",
);

console.log("스모크 실패 정보 유형·기간 필터 self-test 통과");

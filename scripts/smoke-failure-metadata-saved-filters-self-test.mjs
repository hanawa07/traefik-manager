import assert from "node:assert/strict";

import {
  normalizeSmokeFailureMetadataSavedFilterName,
  parseSmokeFailureMetadataSavedFilters,
  removeSmokeFailureMetadataSavedFilter,
  renameSmokeFailureMetadataSavedFilter,
  SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT,
  sortSmokeFailureMetadataSavedFilters,
  upsertSmokeFailureMetadataSavedFilter,
} from "../frontend/src/features/settings/lib/smokeFailureMetadataSavedFilters.ts";

const loginFilters = {
  endDate: "2026-08-06",
  period: "custom",
  query: "관리자",
  sort: "run_asc",
  startDate: "2026-08-01",
  type: "login",
};

assert.equal(normalizeSmokeFailureMetadataSavedFilterName("  최근   로그인  "), "최근 로그인");
assert.deepEqual(parseSmokeFailureMetadataSavedFilters(null), []);
assert.deepEqual(parseSmokeFailureMetadataSavedFilters("invalid"), []);
assert.deepEqual(
  parseSmokeFailureMetadataSavedFilters(
    JSON.stringify([
      { filters: loginFilters, name: "로그인" },
      {
        filters: {
          endDate: "2026-02-30",
          period: "custom",
          sort: "invalid",
          startDate: "not-a-date",
          type: "invalid",
        },
        name: "손상 값",
      },
      { filters: loginFilters, name: " 로그인 " },
      { filters: loginFilters, name: "" },
    ]),
  ),
  [
    { filters: loginFilters, name: "로그인" },
    {
      filters: {
        endDate: "",
        period: "custom",
        query: "",
        sort: "newest",
        startDate: "",
        type: "all",
      },
      name: "손상 값",
    },
  ],
);

let saved = upsertSmokeFailureMetadataSavedFilter([], {
  filters: loginFilters,
  name: " 로그인 ",
});
saved = upsertSmokeFailureMetadataSavedFilter(saved, {
  filters: { ...loginFilters, sort: "oldest" },
  name: "로그인",
});
assert.equal(saved.length, 1);
assert.equal(saved[0].filters.sort, "oldest");
saved = renameSmokeFailureMetadataSavedFilter(saved, "로그인", "Z 운영 로그인");
assert.equal(saved[0].name, "Z 운영 로그인");
assert.equal(saved[0].filters.sort, "oldest");
saved = upsertSmokeFailureMetadataSavedFilter(saved, {
  filters: loginFilters,
  name: "A API",
});
assert.deepEqual(
  sortSmokeFailureMetadataSavedFilters(saved, "name_asc").map(({ name }) => name),
  ["A API", "Z 운영 로그인"],
);
assert.deepEqual(
  sortSmokeFailureMetadataSavedFilters(saved, "name_desc").map(({ name }) => name),
  ["Z 운영 로그인", "A API"],
);
assert.deepEqual(
  renameSmokeFailureMetadataSavedFilter(saved, "Z 운영 로그인", "A API"),
  saved,
);
assert.deepEqual(
  removeSmokeFailureMetadataSavedFilter(saved, " Z 운영 로그인 ").map(({ name }) => name),
  ["A API"],
);

for (let index = 0; index < SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT + 3; index += 1) {
  saved = upsertSmokeFailureMetadataSavedFilter(saved, {
    filters: loginFilters,
    name: `필터 ${index}`,
  });
}
assert.equal(saved.length, SMOKE_FAILURE_METADATA_SAVED_FILTER_LIMIT);
assert.equal(saved[0].name, "필터 22");
assert.equal(saved.at(-1).name, "필터 3");

console.log("스모크 실패 정보 저장 필터 self-test 통과");

import assert from "node:assert/strict";

import {
  buildSmokeFailureMetadataExport,
  normalizeSmokeFailureMetadataExportBaseName,
  resolveSmokeFailureMetadataExportFilenamePreference,
} from "../frontend/src/features/settings/lib/smokeFailureMetadataExport.ts";

const entries = [
  {
    run_id: 987,
    failure_type: "login",
    captured_at: "2026-08-06T00:00:00Z",
    check_name: "=cmd",
    screen_path: "/login",
    page_title: '로그인 "화면"',
  },
];
const csv = buildSmokeFailureMetadataExport(entries, {
  exportedAt: "2026-08-06T01:02:03Z",
  format: "csv",
  scope: "selected",
  timezone: "Asia/Seoul",
});

assert.equal(
  csv.filename,
  "traefik-manager-smoke-failure-metadata-selected-2026-08-06.csv",
);
assert.equal(
  normalizeSmokeFailureMetadataExportBaseName("  ../운영 / 실패   정보  "),
  "운영-실패-정보",
);
assert.equal(
  normalizeSmokeFailureMetadataExportBaseName("🔥🔥"),
  "traefik-manager-smoke-failure-metadata",
);
assert.equal(
  resolveSmokeFailureMetadataExportFilenamePreference(null),
  "traefik-manager-smoke-failure-metadata",
);
assert.equal(
  resolveSmokeFailureMetadataExportFilenamePreference("가".repeat(100)).length,
  80,
);
assert.equal(csv.mimeType, "text/csv;charset=utf-8");
assert.ok(csv.content.startsWith('\uFEFF"run_id","failure_type","captured_at"'));
assert.ok(csv.content.includes('"987","login","2026-08-06T00:00:00Z"'));
assert.ok(csv.content.includes('"\'=cmd"'));
assert.ok(csv.content.includes('"로그인 ""화면"""'));

const json = buildSmokeFailureMetadataExport(entries, {
  exportedAt: "2026-08-06T01:02:03Z",
  format: "json",
  scope: "selected",
  timezone: "Asia/Seoul",
});
const payload = JSON.parse(json.content);
assert.equal(payload.metadata.schema_version, 2);
assert.equal(payload.metadata.result_count, 1);
assert.equal(payload.metadata.scope, "selected");
assert.equal(payload.metadata.timezone, "Asia/Seoul");
assert.equal(payload.entries[0].run_id, 987);

const customJson = buildSmokeFailureMetadataExport(entries, {
  exportedAt: "2026-08-06T01:02:03Z",
  filenameBase: "운영 / 실패 정보",
  format: "json",
  scope: "selected",
  timezone: "Asia/Seoul",
});
assert.equal(customJson.filename, "운영-실패-정보-selected-2026-08-06.json");

const filteredJson = buildSmokeFailureMetadataExport(entries, {
  exportedAt: "2026-08-06T01:02:03Z",
  filters: {
    end_date: "2026-08-06",
    period: "custom",
    query: "관리자",
    sort: "run_asc",
    start_date: "2026-08-01",
    type: "login",
  },
  format: "json",
  scope: "filtered",
  timezone: "Asia/Seoul",
});
const filteredPayload = JSON.parse(filteredJson.content);
assert.equal(
  filteredJson.filename,
  "traefik-manager-smoke-failure-metadata-filtered-2026-08-06.json",
);
assert.deepEqual(filteredPayload.metadata.filters, {
  end_date: "2026-08-06",
  period: "custom",
  query: "관리자",
  sort: "run_asc",
  start_date: "2026-08-01",
  type: "login",
});

const filteredCsv = buildSmokeFailureMetadataExport(entries, {
  exportedAt: "2026-08-06T01:02:03Z",
  filters: {
    end_date: "2026-08-06",
    period: "custom",
    query: "관리자",
    sort: "run_asc",
    start_date: "2026-08-01",
    type: "login",
  },
  format: "csv",
  scope: "filtered",
  timezone: "Asia/Seoul",
});
assert.ok(
  filteredCsv.content.startsWith(
    '\uFEFF"run_id","failure_type","captured_at","check_name","screen_path","page_title","filter_type","filter_period","filter_start_date","filter_end_date","filter_timezone","filter_query","filter_sort"',
  ),
);
assert.ok(
  filteredCsv.content.includes(
    '"login","custom","2026-08-01","2026-08-06","Asia/Seoul","관리자","run_asc"',
  ),
);

console.log("스모크 실패 정보 JSON·CSV 내보내기 self-test 통과");

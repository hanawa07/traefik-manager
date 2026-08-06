import assert from "node:assert/strict";

import {
  buildSmokeFailureMetadataExport,
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
assert.equal(payload.metadata.result_count, 1);
assert.equal(payload.metadata.scope, "selected");
assert.equal(payload.metadata.timezone, "Asia/Seoul");
assert.equal(payload.entries[0].run_id, 987);

console.log("스모크 실패 정보 JSON·CSV 내보내기 self-test 통과");

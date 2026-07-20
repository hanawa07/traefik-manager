import assert from "node:assert/strict";

import {
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  filterTraefikUpdateHistory,
  isTraefikUpdateHistoryDateRangeValid,
} from "../frontend/src/app/dashboard/traefikUpdateHistoryFilter.ts";
import { buildTraefikUpdateHistoryExport } from "../frontend/src/app/dashboard/traefikUpdateHistoryExport.ts";

const entry = (requestId, status, completedAt, actor = "self-test") => ({
  request_id: requestId,
  actor,
  status,
  from_version: "v3.7.8",
  target_version: "v3.7.9",
  requested_at: completedAt,
  started_at: completedAt,
  completed_at: completedAt,
  message: "fixture",
  backup_dir: null,
  backup_created: status !== "rejected",
  rollback_performed: status.includes("rollback"),
  validations: [],
});
const entries = [
  entry("recent", "success", "2026-07-20T11:00:00Z"),
  entry("rollback", "rollback_failed", "2026-07-10T12:00:00Z", "=fixture"),
  entry("old", "rejected", "2026-05-01T12:00:00Z"),
];
const referenceTime = Date.parse("2026-07-20T12:00:00Z");

assert.deepEqual(
  filterTraefikUpdateHistory(entries, {
    ...DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
    period: "30",
    status: "rollback_failed",
  }, referenceTime).map((item) => item.request_id),
  ["rollback"],
);
assert.deepEqual(
  filterTraefikUpdateHistory(entries, {
    ...DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
    dateFrom: "2026-07-10",
    dateTo: "2026-07-10",
  }, referenceTime).map((item) => item.request_id),
  ["rollback"],
);
assert.equal(isTraefikUpdateHistoryDateRangeValid({
  dateFrom: "2026-07-21",
  dateTo: "2026-07-20",
}), false);

const csv = buildTraefikUpdateHistoryExport(
  [entries[1]],
  { ...DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS, status: "rollback_failed" },
  "csv",
  "Asia/Seoul",
  "2026-07-20T12:00:00Z",
);
assert.equal(csv.filename, "traefik-updates-rollback_failed-all-time-2026-07-20.csv");
assert.equal(csv.content.startsWith("\uFEFFmetadata,value\r\n"), true);
assert.match(csv.content, /result_count,"1"/);
assert.match(csv.content, /"'=fixture"/);

const json = JSON.parse(buildTraefikUpdateHistoryExport(
  entries,
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  "json",
  "Asia/Seoul",
  "2026-07-20T12:00:00Z",
).content);
assert.equal(json.metadata.result_count, 3);
assert.equal(json.metadata.timezone, "Asia/Seoul");
console.log("Traefik 업데이트 이력 필터·내보내기 self-test 통과");

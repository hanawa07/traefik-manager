import assert from "node:assert/strict";

import {
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  filterTraefikUpdateHistory,
  isTraefikUpdateHistoryDateRangeValid,
  readTraefikUpdateHistoryFilters,
  replaceTraefikUpdateHistoryQuery,
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

assert.deepEqual(
  readTraefikUpdateHistoryFilters(new URLSearchParams(
    "traefik_update_status=rollback_failed&traefik_update_period=30",
  )),
  { dateFrom: "", dateTo: "", period: "30", status: "rollback_failed" },
);
assert.deepEqual(
  readTraefikUpdateHistoryFilters(new URLSearchParams(
    "traefik_update_status=invalid&traefik_update_period=7&traefik_update_from=2026-02-31&traefik_update_to=2026-07-20",
  )),
  { dateFrom: "", dateTo: "2026-07-20", period: "all", status: "all" },
);

let currentUrl = "https://manager.example.com/dashboard?maintenance_history_actor=ops#updates";
globalThis.window = {
  history: {
    replaceState: (state, _unused, nextUrl) => {
      currentUrl = new URL(nextUrl, currentUrl).href;
      globalThis.window.history.state = state;
      globalThis.window.location.href = currentUrl;
    },
    state: { fixture: true },
  },
  location: { href: currentUrl },
};
replaceTraefikUpdateHistoryQuery({
  dateFrom: "2026-07-10",
  dateTo: "2026-07-20",
  period: "all",
  status: "rollback_failed",
});
let updatedUrl = new URL(currentUrl);
assert.equal(updatedUrl.searchParams.get("maintenance_history_actor"), "ops");
assert.equal(updatedUrl.searchParams.get("traefik_update_from"), "2026-07-10");
assert.equal(updatedUrl.searchParams.get("traefik_update_to"), "2026-07-20");
assert.equal(updatedUrl.searchParams.get("traefik_update_status"), "rollback_failed");
assert.equal(updatedUrl.hash, "#updates");
replaceTraefikUpdateHistoryQuery(DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS);
updatedUrl = new URL(currentUrl);
assert.equal(updatedUrl.searchParams.has("traefik_update_from"), false);
assert.equal(updatedUrl.searchParams.has("traefik_update_to"), false);
assert.equal(updatedUrl.searchParams.has("traefik_update_status"), false);
assert.equal(updatedUrl.searchParams.get("maintenance_history_actor"), "ops");
console.log("Traefik 업데이트 이력 필터·내보내기 self-test 통과");

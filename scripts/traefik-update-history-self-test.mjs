import assert from "node:assert/strict";

import {
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  filterTraefikUpdateHistory,
  isTraefikUpdateHistoryDateRangeValid,
  readTraefikUpdateHistoryFilters,
  replaceTraefikUpdateHistoryQuery,
} from "../frontend/src/app/dashboard/traefikUpdateHistoryFilter.ts";
import { buildTraefikUpdateHistoryExport } from "../frontend/src/app/dashboard/traefikUpdateHistoryExport.ts";

const entry = (requestId, status, completedAt, actor = "self-test", overrides = {}) => ({
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
  alert_request_status: "not_needed",
  alert_run_url: null,
  alert_retry_actor: null,
  alert_retry_requested_at: null,
  alert_run_status: null,
  alert_run_conclusion: null,
  alert_run_checked_at: null,
  alert_run_error: null,
  validations: [],
  ...overrides,
});
const entries = [
  entry("recent", "success", "2026-07-20T11:00:00Z"),
  entry("rollback", "rollback_failed", "2026-07-10T12:00:00Z", "=fixture", {
    alert_request_status: "requested",
    alert_run_url: "https://github.com/hanawa07/traefik-manager/actions/runs/123",
    alert_retry_actor: "security-admin",
    alert_retry_requested_at: "2026-07-10T12:00:30Z",
    alert_run_status: "completed",
    alert_run_conclusion: "success",
    alert_run_checked_at: "2026-07-10T12:01:00Z",
  }),
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
assert.match(csv.content, /schema_version,"3"/);
assert.match(csv.content, /result_count,"1"/);
assert.match(csv.content, /alert_request_status,alert_run_url,alert_retry_actor,alert_retry_requested_at/);
assert.match(csv.content, /github\.com\/hanawa07\/traefik-manager\/actions\/runs\/123/);
assert.match(csv.content, /security-admin/);
assert.match(csv.content, /"'=fixture"/);

const json = JSON.parse(buildTraefikUpdateHistoryExport(
  entries,
  DEFAULT_TRAEFIK_UPDATE_HISTORY_FILTERS,
  "json",
  "Asia/Seoul",
  "2026-07-20T12:00:00Z",
).content);
assert.equal(json.metadata.result_count, 3);
assert.equal(json.metadata.schema_version, 3);
assert.equal(json.metadata.timezone, "Asia/Seoul");
assert.equal(json.entries[1].alert_run_conclusion, "success");
assert.equal(json.entries[1].alert_retry_actor, "security-admin");

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

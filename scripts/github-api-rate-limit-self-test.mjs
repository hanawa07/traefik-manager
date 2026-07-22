import assert from "node:assert/strict";

import { auditFilters } from "../frontend/src/app/dashboard/audit/audit-page-helpers/auditFilterOptions.ts";
import { getGithubApiRateLimitDetailRows } from "../frontend/src/app/dashboard/audit/audit-page-helpers/githubApiRateLimitDetailRows.ts";
import {
  isGithubApiRefreshBlocked,
  isGithubSecondaryRateLimitBlocked,
} from "../frontend/src/features/settings/lib/smokeGithubRateLimit.ts";

const now = Date.parse("2026-07-22T01:00:00+00:00");
const resetAt = "2026-07-22T02:00:00+00:00";

assert.equal(isGithubApiRefreshBlocked(8, resetAt, null, 8, now), true);
assert.equal(isGithubApiRefreshBlocked(9, resetAt, null, 8, now), false);
assert.equal(isGithubSecondaryRateLimitBlocked("2026-07-22T01:01:00+00:00", now), true);

const rows = getGithubApiRateLimitDetailRows("github_api_secondary_rate_limit", {
  occurred_at: "2026-07-22T01:00:00+00:00",
  occurrence_count: 2,
  alert_triggered: true,
  alert_window_hours: 24,
  alert_threshold: 3,
  window_occurrence_count: 3,
  retry_at: "2026-07-22T01:01:00+00:00",
});
assert.deepEqual(rows.map((row) => row.value), [
  "보조 요청 제한",
  "2026-07-22T01:00:00+00:00",
  "2회",
  "24시간 내 3회 · 경고 기준 도달",
  "3회",
  "2026-07-22T01:01:00+00:00",
]);
assert.deepEqual(getGithubApiRateLimitDetailRows("service_update", {}), []);
assert.equal(
  auditFilters.some(({ key }) => key === "github_api_rate_limit"),
  true,
);

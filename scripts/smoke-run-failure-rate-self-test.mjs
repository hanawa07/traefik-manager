import assert from "node:assert/strict";

import {
  getCompletedSmokeRunsInWindow,
  getSmokeRunFailureRate,
} from "../frontend/src/app/dashboard/smokeRunFailureRate.ts";
import { getSmokeArtifactExpiryState } from "../frontend/src/app/dashboard/smokeArtifactExpiry.ts";

const now = Date.parse("2026-07-18T00:00:00Z");
const high = getSmokeRunFailureRate(
  [
    { status: "failure", completed_at: "2026-07-17T00:00:00Z" },
    { status: "failure", completed_at: "2026-07-16T00:00:00Z" },
    { status: "success", completed_at: "2026-07-15T00:00:00Z" },
    { status: "success", completed_at: "2026-07-14T00:00:00Z" },
    { status: "success", completed_at: "2026-07-13T00:00:00Z" },
    { status: "skipped", completed_at: "2026-07-12T00:00:00Z" },
    { status: "failure", completed_at: "2026-07-01T00:00:00Z" },
  ],
  now,
);
assert.deepEqual(high, {
  failureCount: 2,
  isAlert: true,
  percentage: 40,
  totalCount: 5,
});

const insufficient = getSmokeRunFailureRate(
  [
    { status: "failure", completed_at: "2026-07-17T00:00:00Z" },
    { status: "success", completed_at: "invalid" },
  ],
  now,
);
assert.equal(insufficient.percentage, 100);
assert.equal(insufficient.isAlert, false);

const configured = getSmokeRunFailureRate(
  [
    { status: "failure", completed_at: "2026-07-17T00:00:00Z" },
    { status: "success", completed_at: "2026-07-16T00:00:00Z" },
  ],
  now,
  60,
  2,
);
assert.equal(configured.percentage, 50);
assert.equal(configured.isAlert, false);

const thirtyDays = getSmokeRunFailureRate(
  [
    { status: "failure", completed_at: "2026-07-17T00:00:00Z" },
    { status: "failure", completed_at: "2026-07-01T00:00:00Z" },
    { status: "success", completed_at: "2026-06-25T00:00:00Z" },
  ],
  now,
  50,
  3,
  30,
);
assert.equal(thirtyDays.totalCount, 3);
assert.equal(thirtyDays.isAlert, true);
assert.deepEqual(
  getCompletedSmokeRunsInWindow(
    [
      { status: "failure", completed_at: "2026-07-17T00:00:00Z", run_url: "recent" },
      { status: "skipped", completed_at: "2026-07-16T00:00:00Z", run_url: "skipped" },
      { status: "failure", completed_at: "2026-07-01T00:00:00Z", run_url: "older" },
    ],
    now,
    30,
  ).map((run) => run.run_url),
  ["recent", "older"],
);

assert.equal(getSmokeArtifactExpiryState("invalid", now), null);
assert.equal(getSmokeArtifactExpiryState("2026-07-18T00:00:00Z", now), "expired");
assert.equal(getSmokeArtifactExpiryState("2026-07-21T00:00:00Z", now), "expiring_soon");
assert.equal(getSmokeArtifactExpiryState("2026-07-22T00:00:01Z", now), "active");

console.log("운영 점검 실패율 self-test 통과");

import assert from "node:assert/strict";

import {
  getCompletedSmokeRunsInWindow,
  getSmokeRunFailureRate,
} from "../frontend/src/app/dashboard/smokeRunFailureRate.ts";
import {
  filterAndPrioritizeSmokeArtifactRuns,
  getSmokeArtifactFilterCounts,
  getSmokeArtifactExpiryState,
  getSmokeArtifactRemainingLabel,
} from "../frontend/src/shared/lib/smokeArtifactExpiry.ts";
import {
  findNewSmokeRun,
  getTrackedManualSmokeRun,
  parseTrackedManualSmokeRun,
} from "../frontend/src/features/settings/lib/smokeManualRunTracking.ts";

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
assert.equal(getSmokeArtifactRemainingLabel("invalid", now), null);
assert.equal(getSmokeArtifactRemainingLabel("2026-07-18T00:00:00Z", now), null);
assert.equal(getSmokeArtifactRemainingLabel("2026-07-18T00:00:30Z", now), "1분 남음");
assert.equal(getSmokeArtifactRemainingLabel("2026-07-18T01:01:00Z", now), "1시간 1분 남음");
assert.equal(getSmokeArtifactRemainingLabel("2026-07-19T00:30:00Z", now), "1일 30분 남음");
assert.equal(getSmokeArtifactRemainingLabel("2026-07-20T03:30:00Z", now), "2일 3시간 남음");

const artifactRuns = [
  { id: "none", artifact_url: null, artifact_expires_at: null },
  { id: "expired", artifact_url: "expired", artifact_expires_at: "2026-07-17T00:00:00Z" },
  { id: "unknown", artifact_url: "unknown", artifact_expires_at: null },
  { id: "active", artifact_url: "active", artifact_expires_at: "2026-07-22T00:00:01Z" },
  { id: "soon", artifact_url: "soon", artifact_expires_at: "2026-07-19T00:00:00Z" },
];
assert.deepEqual(
  filterAndPrioritizeSmokeArtifactRuns(artifactRuns, "all", now).map((run) => run.id),
  ["soon", "active", "unknown", "expired", "none"],
);
assert.deepEqual(
  filterAndPrioritizeSmokeArtifactRuns(artifactRuns, "available", now).map((run) => run.id),
  ["soon", "active", "unknown"],
);
assert.deepEqual(
  filterAndPrioritizeSmokeArtifactRuns(artifactRuns, "expiring_soon", now).map((run) => run.id),
  ["soon"],
);
assert.deepEqual(
  filterAndPrioritizeSmokeArtifactRuns(artifactRuns, "expired", now).map((run) => run.id),
  ["expired"],
);
assert.deepEqual(getSmokeArtifactFilterCounts(artifactRuns, now), {
  all: 5,
  available: 3,
  expiring_soon: 1,
  expired: 1,
});

const smokeRuns = [
  { run_url: "new", status: "success", completed_at: "2026-07-18T00:00:00Z" },
  { run_url: "known", status: "failure", completed_at: "2026-07-17T00:00:00Z" },
];
assert.equal(findNewSmokeRun(smokeRuns, ["known"])?.run_url, "new");
assert.equal(findNewSmokeRun(smokeRuns, ["new", "known"]), null);

const trackedManualRun = getTrackedManualSmokeRun({
  completed_at: "2026-07-20T06:00:00Z",
  run_number: 123,
  run_url: "https://github.com/hanawa07/traefik-manager/actions/runs/123",
  status: "success",
});
assert.deepEqual(parseTrackedManualSmokeRun(JSON.stringify(trackedManualRun)), trackedManualRun);
assert.equal(parseTrackedManualSmokeRun("not-json"), null);
assert.equal(parseTrackedManualSmokeRun(JSON.stringify({ ...trackedManualRun, status: "running" })), null);
assert.equal(
  parseTrackedManualSmokeRun(
    JSON.stringify({ ...trackedManualRun, run_url: "https://example.com/actions/runs/123" }),
  ),
  null,
);

console.log("운영 점검 실패율 self-test 통과");

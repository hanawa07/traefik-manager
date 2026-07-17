import assert from "node:assert/strict";

import { buildDeploymentBottleneckPreview } from "../frontend/src/features/deployment/lib/deploymentBottleneckPreview.ts";

const entries = [
  { status: "success", version: "v1.0.3", stage_durations_ms: { build: 70_000 } },
  { status: "success", version: "v1.0.2", stage_durations_ms: { build: 80_000 } },
  { status: "success", version: "v1.0.1", stage_durations_ms: { build: 30_000 } },
];

const pending = buildDeploymentBottleneckPreview(entries, 60_000, 3);
assert.equal(pending.currentCount, 2);
assert.equal(pending.remainingCount, 1);
assert.equal(pending.wouldAlert, false);
assert.equal(pending.slowestMs, 80_000);
assert.equal(pending.latestVersion, "v1.0.3");

assert.equal(buildDeploymentBottleneckPreview(entries, 60_000, 2).wouldAlert, true);
assert.equal(buildDeploymentBottleneckPreview(entries, 75_000, 3).currentCount, 0);
assert.equal(
  buildDeploymentBottleneckPreview(
    [{ ...entries[0], status: "failed_before_switch" }, ...entries.slice(1)],
    60_000,
    3,
  ).currentCount,
  0,
);

console.log("Manager 배포 병목 예상 결과 self-test 통과");

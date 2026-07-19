import assert from "node:assert/strict";

import {
  applyRoutingModeUpdates,
  countServiceRoutingModes,
  getRoutingUpdateTargets,
} from "../frontend/src/features/services/lib/serviceRouting.ts";
import {
  toKoreanDateTimeLocal,
  toMaintenanceUntilIso,
} from "../frontend/src/features/services/lib/maintenanceSchedule.ts";

const services = [
  { id: "active", routing_mode: "active" },
  { id: "disabled", routing_mode: "disabled" },
  { id: "maintenance", routing_mode: "maintenance" },
  { id: "second-active", routing_mode: "active" },
];

assert.deepEqual(countServiceRoutingModes(services), {
  active: 2,
  disabled: 1,
  maintenance: 1,
});
assert.deepEqual(
  getRoutingUpdateTargets(services, ["active", "disabled"], "disabled").map(
    (service) => service.id,
  ),
  ["active"],
);

const updateEvents = [];
const updateResult = await applyRoutingModeUpdates(services.slice(0, 3), "maintenance", async (id, mode) => {
  updateEvents.push(`start:${id}:${mode}`);
  await Promise.resolve();
  if (id === "disabled") throw new Error("expected test failure");
  updateEvents.push(`end:${id}`);
});
assert.deepEqual(updateResult, { successCount: 2, failedServiceIds: ["disabled"] });
assert.deepEqual(updateEvents, [
  "start:active:maintenance",
  "end:active",
  "start:disabled:maintenance",
  "start:maintenance:maintenance",
  "end:maintenance",
]);
assert.equal(toMaintenanceUntilIso("2030-01-02T12:04"), "2030-01-02T03:04:00.000Z");
assert.equal(toKoreanDateTimeLocal("2030-01-02T03:04:00Z"), "2030-01-02T12:04");

console.log("서비스 운영 상태 집계·순차 일괄 변경·점검 시각 self-test 통과");

import assert from "node:assert/strict";

import {
  applyRoutingModeUpdates,
  countServiceRoutingModes,
  getRoutingUpdateTargets,
} from "../frontend/src/features/services/lib/serviceRouting.ts";
import {
  formatMaintenanceRemaining,
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
const maintenanceNow = Date.parse("2030-01-02T00:00:00Z");
assert.equal(formatMaintenanceRemaining("2030-01-02T00:25:00Z", maintenanceNow), "25분 남음");
assert.equal(formatMaintenanceRemaining("2030-01-02T02:05:00Z", maintenanceNow), "2시간 5분 남음");
assert.equal(formatMaintenanceRemaining("2030-01-03T02:00:00Z", maintenanceNow), "1일 2시간 남음");
assert.equal(formatMaintenanceRemaining("2030-01-01T23:59:00Z", maintenanceNow), "종료 처리 중");

console.log("서비스 운영 상태 집계·순차 일괄 변경·점검 시각·잔여시간 self-test 통과");

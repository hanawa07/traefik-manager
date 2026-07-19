import assert from "node:assert/strict";

import {
  applyRoutingModeUpdates,
  countServiceRoutingModes,
  getRoutingUpdateTargets,
} from "../frontend/src/features/services/lib/serviceRouting.ts";
import {
  formatMaintenanceRemaining,
  getMaintenanceSchedule,
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
const maintenanceSchedule = getMaintenanceSchedule([
  { id: "active", name: "Active", domain: "active.test", routing_mode: "active", maintenance_until: null },
  { id: "later", name: "Later", domain: "later.test", routing_mode: "maintenance", maintenance_until: "2030-01-04T00:00:00Z" },
  { id: "soon", name: "Soon", domain: "soon.test", routing_mode: "maintenance", maintenance_until: "2030-01-02T12:00:00Z" },
  { id: "overdue", name: "Overdue", domain: "overdue.test", routing_mode: "maintenance", maintenance_until: "2029-12-31T23:59:00Z" },
  { id: "open", name: "Open", domain: "open.test", routing_mode: "maintenance", maintenance_until: null },
], maintenanceNow);
assert.deepEqual(
  maintenanceSchedule.map((entry) => [entry.service.id, entry.timing]),
  [["overdue", "overdue"], ["soon", "soon"], ["later", "scheduled"], ["open", "unscheduled"]],
);

console.log("서비스 운영 상태 집계·순차 일괄 변경·점검 일정 self-test 통과");

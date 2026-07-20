import assert from "node:assert/strict";

import {
  readMaintenanceHistoryServiceId,
  replaceMaintenanceHistoryServiceId,
} from "../frontend/src/app/dashboard/maintenanceHistoryServiceQuery.ts";

const serviceId = "00000000-0000-4000-8000-000000000101";
let currentUrl = `https://manager.example.com/dashboard?maintenance_history_actor=ops&maintenance_history_service=${serviceId}`;

globalThis.window = {
  history: {
    replaceState: (_state, _unused, nextUrl) => {
      currentUrl = new URL(nextUrl, currentUrl).href;
      globalThis.window.location.href = currentUrl;
      globalThis.window.location.search = new URL(currentUrl).search;
    },
    state: { fixture: true },
  },
  location: {
    href: currentUrl,
    search: new URL(currentUrl).search,
  },
};

assert.equal(readMaintenanceHistoryServiceId(), serviceId);
replaceMaintenanceHistoryServiceId(null);
assert.equal(new URL(currentUrl).searchParams.has("maintenance_history_service"), false);
assert.equal(new URL(currentUrl).searchParams.get("maintenance_history_actor"), "ops");

replaceMaintenanceHistoryServiceId(serviceId);
assert.equal(new URL(currentUrl).searchParams.get("maintenance_history_service"), serviceId);
globalThis.window.location.search = "?maintenance_history_service=invalid";
assert.equal(readMaintenanceHistoryServiceId(), null);
console.log("점검 변경 이력 서비스 URL self-test 통과");

import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

export const SERVICE_ID = "00000000-0000-4000-8000-000000000101";
export const SERVICE_NAME = "점검 스모크 1";

export async function installRequestCapture(cdp) {
  const installed = await evaluate(cdp, `(() => {
    window.__tmMaintenanceRequests = [];
    window.__tmMaintenanceConfirmMessages = [];
    window.__tmMaintenanceOriginalOpen = XMLHttpRequest.prototype.open;
    window.__tmMaintenanceOriginalConfirm = window.confirm;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (String(url).includes('/api/v1/services/${SERVICE_ID}')) {
        window.__tmMaintenanceRequests.push({ method: String(method).toUpperCase(), url: String(url) });
      }
      return window.__tmMaintenanceOriginalOpen.call(this, method, url, ...rest);
    };
    window.confirm = (message) => {
      window.__tmMaintenanceConfirmMessages.push(String(message));
      return false;
    };
    return true;
  })()`);
  assert.equal(installed, true, "점검 일정 요청 캡처를 준비하지 못했습니다");
}

export async function restoreRequestCapture(cdp) {
  await evaluate(cdp, `(() => {
    if (window.__tmMaintenanceOriginalOpen) {
      XMLHttpRequest.prototype.open = window.__tmMaintenanceOriginalOpen;
    }
    if (window.__tmMaintenanceOriginalConfirm) window.confirm = window.__tmMaintenanceOriginalConfirm;
    delete window.__tmMaintenanceRequests;
    delete window.__tmMaintenanceConfirmMessages;
    delete window.__tmMaintenanceOriginalOpen;
    delete window.__tmMaintenanceOriginalConfirm;
  })()`);
}

export function assertRequest(request, method, pathname) {
  assert.equal(request.request.method, method);
  assert.equal(new URL(request.request.url).pathname, pathname);
}

export function waitForFetch(cdp, timeoutMs, label) {
  return cdp.waitFor("Fetch.requestPaused", timeoutMs).catch((error) => {
    throw new Error(`${label}: ${error.message}`);
  });
}

export async function fulfillJson(cdp, request, value) {
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(value)).toString("base64"),
  });
}

export function buildMaintenanceServices(now = Date.now()) {
  const offsets = [1, 4, 8, 12, 30];
  return offsets.map((hours, index) => ({
    id: `00000000-0000-4000-8000-00000000010${index + 1}`,
    name: `점검 스모크 ${index + 1}`,
    domain: `maintenance-smoke-${index + 1}.invalid`,
    upstream_host: "maintenance-smoke",
    upstream_port: 3000,
    routing_mode: "maintenance",
    maintenance_message: "스모크 점검 안내",
    maintenance_until: new Date(now + hours * 60 * 60 * 1_000).toISOString(),
    upstream_scheme: "http",
    skip_tls_verify: false,
    tls_enabled: true,
    https_redirect_enabled: true,
    auth_enabled: false,
    auth_mode: "none",
    api_key: null,
    allowed_ips: [],
    blocked_paths: [],
    rate_limit_enabled: false,
    rate_limit_average: null,
    rate_limit_burst: null,
    custom_headers: {},
    frame_policy: "deny",
    healthcheck_enabled: false,
    healthcheck_path: "/",
    healthcheck_timeout_ms: 3000,
    healthcheck_expected_statuses: [],
    basic_auth_enabled: false,
    basic_auth_user_count: 0,
    basic_auth_usernames: [],
    middleware_template_ids: [],
    authentik_group_id: null,
    authentik_group_name: null,
    cloudflare_record_id: null,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  }));
}

export function buildMaintenanceHistory() {
  return [
    {
      id: "00000000-0000-4000-8000-000000000111",
      actor: "ops-admin",
      action: "update",
      resource_type: "service",
      resource_id: SERVICE_ID,
      resource_name: SERVICE_NAME,
      event: "service_update",
      created_at: "2035-02-03T05:30:01.000Z",
      detail: {
        event: "service_update",
        changed_keys: ["maintenance_until"],
        before: { maintenance_until: null },
        after: { maintenance_until: "2035-02-03T05:30:00.000Z" },
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000112",
      actor: "smoke-admin",
      action: "update",
      resource_type: "service",
      resource_id: SERVICE_ID,
      resource_name: SERVICE_NAME,
      event: "service_update",
      created_at: "2035-02-02T05:30:01.000Z",
      detail: {
        event: "service_update",
        changed_keys: ["maintenance_until", "routing_mode"],
        before: { maintenance_until: "2035-02-02T04:30:00.000Z" },
        after: { maintenance_until: "2035-02-02T05:30:00.000Z" },
      },
    },
  ];
}

export function runMaintenanceScheduleFixtureSelfTest() {
  const services = buildMaintenanceServices(Date.parse("2030-01-01T00:00:00Z"));
  const history = buildMaintenanceHistory();
  assert.equal(services.length, 5);
  assert.equal(services[0].id, SERVICE_ID);
  assert.equal(services[4].maintenance_until, "2030-01-02T06:00:00.000Z");
  assert.equal(history.length, 2);
  assert.equal(history[0].detail.before.maintenance_until, null);
  assert.equal(history[0].actor, "ops-admin");
}

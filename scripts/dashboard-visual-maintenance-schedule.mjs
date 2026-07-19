import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const SERVICE_ID = "00000000-0000-4000-8000-000000000101";
const SERVICE_NAME = "점검 스모크 1";

export async function checkMaintenanceScheduleFixture({ canManage, cdp, timeoutMs }) {
  if (!canManage) return false;
  let services = buildMaintenanceServices();
  const origin = await evaluate(cdp, "location.origin");
  await cdp.send("Fetch.enable", {
    patterns: [
      { requestStage: "Request", urlPattern: "*/api/v1/services" },
      { requestStage: "Request", urlPattern: `*/api/v1/services/${SERVICE_ID}` },
    ],
  });
  try {
    const initialRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${origin}/dashboard` });
    const initial = await initialRequest;
    assertRequest(initial, "GET", "/api/v1/services");
    await fulfillJson(cdp, initial, services);
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const card = document.querySelector('[data-testid="maintenance-schedule-summary"]');
        return card?.getAttribute('data-maintenance-service-count') === '5' &&
          document.querySelectorAll('[data-maintenance-service-id]').length === 3 &&
          document.querySelector('[data-maintenance-schedule-toggle]')?.textContent?.includes('전체 5개 보기');
      })()`,
      timeoutMs,
      "점검 일정 fixture의 축약 목록이 표시되지 않았습니다",
    );

    const expanded = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-maintenance-schedule-toggle]');
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(expanded, true, "점검 일정 전체 보기 버튼이 없습니다");
    await waitForCondition(
      cdp,
      `document.querySelectorAll('[data-maintenance-service-id]').length === 5 &&
        document.querySelector('[data-maintenance-schedule-toggle]')?.getAttribute('aria-expanded') === 'true'`,
      timeoutMs,
      "점검 일정 전체 목록이 펼쳐지지 않았습니다",
    );

    await installRequestCapture(cdp);
    try {
      const patchRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
      await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 1시간 연장`);
      const patch = await patchRequest;
      assertRequest(patch, "PATCH", `/api/v1/services/${SERVICE_ID}`);
      const body = JSON.parse(patch.request.postData || "{}");
      const expectedUntil = new Date(
        Date.parse(services[0].maintenance_until) + 60 * 60 * 1_000,
      ).toISOString();
      assert.deepEqual(body, {
        maintenance_until: expectedUntil,
        routing_mode: "maintenance",
      });

      const refreshedListRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
      services = [{ ...services[0], maintenance_until: expectedUntil }, ...services.slice(1)];
      await fulfillJson(cdp, patch, services[0]);
      const refreshedList = await refreshedListRequest;
      assertRequest(refreshedList, "GET", "/api/v1/services");
      await fulfillJson(cdp, refreshedList, services);
      await waitForCondition(
        cdp,
        `(() => {
          const row = document.querySelector('[data-maintenance-service-id="${SERVICE_ID}"]');
          return row?.getAttribute('data-maintenance-until') === ${JSON.stringify(expectedUntil)} &&
            document.body.innerText.includes('${SERVICE_NAME} 점검 종료를 1시간 연장했습니다.');
        })()`,
        timeoutMs,
        "점검 종료 연장 결과가 화면에 반영되지 않았습니다",
      );

      await clickAriaLabel(cdp, `${SERVICE_NAME} 지금 정상 운영`);
      await waitForCondition(
        cdp,
        "window.__tmMaintenanceConfirmMessages?.length === 1",
        timeoutMs,
        "즉시 정상 운영 확인창이 호출되지 않았습니다",
      );
      await evaluate(cdp, "new Promise((resolve) => setTimeout(resolve, 250))");
      const capture = await evaluate(cdp, `({
        confirms: window.__tmMaintenanceConfirmMessages,
        requests: window.__tmMaintenanceRequests,
      })`);
      assert.match(capture.confirms[0], /점검 스모크 1.*지금 정상 운영/);
      assert.deepEqual(
        capture.requests.map((request) => request.method),
        ["PATCH"],
        "즉시 정상 운영을 취소한 뒤 추가 변경 요청이 발생했습니다",
      );
    } finally {
      await restoreRequestCapture(cdp);
    }
  } finally {
    await cdp.send("Fetch.disable");
  }
  return true;
}

async function installRequestCapture(cdp) {
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

async function restoreRequestCapture(cdp) {
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

function assertRequest(request, method, pathname) {
  assert.equal(request.request.method, method);
  assert.equal(new URL(request.request.url).pathname, pathname);
}

async function fulfillJson(cdp, request, value) {
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(value)).toString("base64"),
  });
}

function buildMaintenanceServices(now = Date.now()) {
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

export function runMaintenanceScheduleFixtureSelfTest() {
  const services = buildMaintenanceServices(Date.parse("2030-01-01T00:00:00Z"));
  assert.equal(services.length, 5);
  assert.equal(services[0].id, SERVICE_ID);
  assert.equal(services[4].maintenance_until, "2030-01-02T06:00:00.000Z");
}

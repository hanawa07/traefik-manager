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
      { requestStage: "Request", urlPattern: `*/api/v1/audit*search=${SERVICE_ID}*` },
    ],
  });
  try {
    const initialRequest = waitForFetch(cdp, timeoutMs, "점검 서비스 목록");
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

    const historyRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 변경 이력");
    await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 종료 시각 변경 이력`);
    const history = await historyRequest;
    assertRequest(history, "GET", "/api/v1/audit");
    const historyUrl = new URL(history.request.url);
    assert.equal(historyUrl.searchParams.get("resource_type"), "service");
    assert.equal(historyUrl.searchParams.get("action"), "update");
    assert.equal(historyUrl.searchParams.get("event"), "service_update");
    assert.equal(historyUrl.searchParams.get("search"), SERVICE_ID);
    await fulfillJson(cdp, history, buildMaintenanceHistory());
    await waitForCondition(
      cdp,
      `(() => {
        const panel = document.querySelector('[data-testid="maintenance-schedule-history"]');
        const latest = panel?.querySelector('[data-maintenance-history-before="unset"]');
        return panel?.getAttribute('data-maintenance-history-count') === '2' &&
          latest?.getAttribute('data-maintenance-history-after') === '2035-02-03T05:30:00.000Z' &&
          panel.textContent?.includes('smoke-admin');
      })()`,
      timeoutMs,
      "점검 종료 시각 변경 이력이 펼쳐지지 않았습니다",
    );

    await installRequestCapture(cdp);
    try {
      const patchRequest = waitForFetch(cdp, timeoutMs, "점검 연장 PATCH");
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

      const refreshedListRequest = waitForFetch(cdp, timeoutMs, "점검 연장 후 서비스 목록");
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

      const directUntilLocal = "2035-02-03T14:30";
      const directUntil = "2035-02-03T05:30:00.000Z";
      const changed = await evaluate(cdp, `(() => {
        const input = document.querySelector('input[aria-label="${SERVICE_NAME} 점검 종료 시각"]');
        if (!(input instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, ${JSON.stringify(directUntilLocal)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return input.value === ${JSON.stringify(directUntilLocal)};
      })()`);
      assert.equal(changed, true, "점검 종료 시각 입력값을 변경하지 못했습니다");
      await waitForCondition(
        cdp,
        `document.querySelector('input[aria-label="${SERVICE_NAME} 점검 종료 시각"]')?.value === ${JSON.stringify(directUntilLocal)} &&
          document.querySelector('button[aria-label="${SERVICE_NAME} 점검 종료 시각 적용"]')?.disabled === false`,
        timeoutMs,
        "점검 종료 시각 직접 편집값이 반영되지 않았습니다",
      );

      const directPatchRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 PATCH");
      await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 종료 시각 적용`);
      const directPatch = await directPatchRequest;
      assertRequest(directPatch, "PATCH", `/api/v1/services/${SERVICE_ID}`);
      assert.deepEqual(JSON.parse(directPatch.request.postData || "{}"), {
        maintenance_until: directUntil,
        routing_mode: "maintenance",
      });

      const directRefreshedListRequest = waitForFetch(cdp, timeoutMs, "점검 시각 변경 후 서비스 목록");
      services = [{ ...services[0], maintenance_until: directUntil }, ...services.slice(1)];
      await fulfillJson(cdp, directPatch, services[0]);
      const directRefreshedList = await directRefreshedListRequest;
      assertRequest(directRefreshedList, "GET", "/api/v1/services");
      await fulfillJson(cdp, directRefreshedList, services);
      await waitForCondition(
        cdp,
        `(() => {
          const row = document.querySelector('[data-maintenance-service-id="${SERVICE_ID}"]');
          return row?.getAttribute('data-maintenance-until') === ${JSON.stringify(directUntil)} &&
            document.body.innerText.includes('${SERVICE_NAME} 점검 종료 시각을 변경했습니다.');
        })()`,
        timeoutMs,
        "점검 종료 시각 직접 편집 결과가 화면에 반영되지 않았습니다",
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
        ["PATCH", "PATCH"],
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

function waitForFetch(cdp, timeoutMs, label) {
  return cdp.waitFor("Fetch.requestPaused", timeoutMs).catch((error) => {
    throw new Error(`${label}: ${error.message}`);
  });
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

function buildMaintenanceHistory() {
  return [
    {
      id: "00000000-0000-4000-8000-000000000111",
      actor: "smoke-admin",
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
}

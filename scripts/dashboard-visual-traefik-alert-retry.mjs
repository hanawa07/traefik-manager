import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const SOURCE_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_VERSION = "v3.7.9";
const UPDATE_OPERATIONS_PATTERN = "*/api/v1/traefik/update-operations*";

const FIXTURE = {
  runner: {
    available: true,
    status: "ready",
    checked_at: "2026-07-20T03:00:00Z",
    message: "fixture ready",
  },
  pending_request: false,
  history: [{
    request_id: SOURCE_REQUEST_ID,
    actor: "release-admin",
    status: "rollback_failed",
    from_version: "v3.7.8",
    target_version: TARGET_VERSION,
    requested_at: "2026-07-20T03:00:00Z",
    started_at: "2026-07-20T03:00:01Z",
    completed_at: "2026-07-20T03:00:05Z",
    message: "fixture rollback and alert failed",
    backup_dir: "/tmp/traefik-update-smoke",
    backup_created: true,
    rollback_performed: true,
    alert_request_status: "request_failed",
    alert_run_url: null,
    alert_retry_actor: "security-admin",
    alert_retry_requested_at: "2026-07-20T03:01:00Z",
    alert_run_status: null,
    alert_run_conclusion: null,
    alert_run_checked_at: null,
    alert_run_error: null,
    validations: [],
  }],
};

export async function checkTraefikAlertRetryAdminFixture({
  baseUrl,
  cdp,
  cookies,
  timeoutMs,
}) {
  await cdp.send("Network.clearBrowserCookies");
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  for (const cookie of cookies) {
    await cdp.send("Network.setCookie", { url: baseUrl, ...cookie });
  }

  try {
    await navigateWithFixture({ baseUrl, cdp, timeoutMs });
    await waitForCondition(
      cdp,
      `(() => {
        const button = document.querySelector(
          ${JSON.stringify(`[data-traefik-update-alert-retry="${SOURCE_REQUEST_ID}"]`)},
        );
        const meta = document.querySelector('[data-traefik-update-alert-retry-meta]');
        return button?.textContent?.includes('알림 다시 요청') &&
          meta?.textContent?.includes('재시도 security-admin');
      })()`,
      timeoutMs,
      "관리자 Traefik 알림 재시도 버튼이 표시되지 않았습니다",
    );
    await assertRetryPost({ cdp, cookies, timeoutMs });
    return true;
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}

async function navigateWithFixture({ baseUrl, cdp, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: UPDATE_OPERATIONS_PATTERN }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}/dashboard` });
    const request = await requestPaused;
    assert.equal(request.request.method, "GET");
    await fulfillJson(cdp, request.requestId, 200, FIXTURE);
    await loaded;
  } finally {
    await cdp.send("Fetch.disable");
  }
}

async function assertRetryPost({ cdp, cookies, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{
      requestStage: "Request",
      urlPattern: "*/api/v1/traefik/update-operations/*/alert-retry",
    }],
  });
  const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const clicked = await evaluate(cdp, `(() => {
    window.confirm = () => true;
    const button = document.querySelector(
      ${JSON.stringify(`[data-traefik-update-alert-retry="${SOURCE_REQUEST_ID}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "Traefik 알림 재시도 버튼을 누르지 못했습니다");

  const request = await requestPaused;
  const headers = Object.fromEntries(
    Object.entries(request.request.headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const csrf = cookies.find((cookie) => cookie.name.toLowerCase().includes("csrf"));
  assert.equal(request.request.method, "POST");
  assert.equal(
    new URL(request.request.url).pathname,
    `/api/v1/traefik/update-operations/${SOURCE_REQUEST_ID}/alert-retry`,
  );
  assert.equal(headers["x-csrf-token"], csrf?.value);
  await fulfillJson(cdp, request.requestId, 202, {
    request_id: "44444444-4444-4444-8444-444444444444",
    target_version: TARGET_VERSION,
    status: "queued",
    requested_at: "2026-07-20T03:02:00Z",
    message: "호스트 실행기에 자동 롤백 실패 알림 재시도를 요청했습니다",
  });
}

function fulfillJson(cdp, requestId, responseCode, body) {
  return cdp.send("Fetch.fulfillRequest", {
    requestId,
    responseCode,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(body)).toString("base64"),
  });
}

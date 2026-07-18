import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { loginSessionCookies } from "./smoke-session-auth.mjs";

const CLEANUP_PATH = "/api/v1/settings/deployment-bottleneck-alert/cleanup";

export async function checkOptionalDeploymentBottleneckCleanupCancel({
  baseUrl,
  cdp,
  timeoutMs,
}) {
  const credentials = resolveOptionalAdminCredentials();
  if (!credentials) return false;

  const cookies = await loginSessionCookies(
    baseUrl,
    credentials.username,
    credentials.password,
  );
  await cdp.send("Network.clearBrowserCookies");
  for (const cookie of cookies) {
    await cdp.send("Network.setCookie", { url: baseUrl, ...cookie });
  }
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  await navigateAndWait(cdp, `${baseUrl}/dashboard/settings`, timeoutMs);
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-deployment-bottleneck-cleanup]'))`,
    timeoutMs,
    "관리자 배포 병목 이벤트 정리 버튼이 표시되지 않았습니다",
  );

  const hooksInstalled = await evaluate(cdp, `(() => {
    window.__tmCleanupMethods = [];
    window.__tmCleanupConfirmMessages = [];
    window.__tmOriginalXhrOpen = XMLHttpRequest.prototype.open;
    window.__tmOriginalConfirm = window.confirm;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (String(url).includes(${JSON.stringify(CLEANUP_PATH)})) {
        const normalizedMethod = String(method).toUpperCase();
        window.__tmCleanupMethods.push(normalizedMethod);
        if (normalizedMethod === 'POST') throw new Error('smoke blocked cleanup POST');
      }
      return window.__tmOriginalXhrOpen.call(this, method, url, ...rest);
    };
    window.confirm = (message) => {
      window.__tmCleanupConfirmMessages.push(String(message));
      return false;
    };
    return true;
  })()`);
  assert.equal(hooksInstalled, true, "정리 취소 요청 캡처를 준비하지 못했습니다");

  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: `*${CLEANUP_PATH}*` }],
  });
  try {
    const previewRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const clicked = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-deployment-bottleneck-cleanup]');
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(clicked, true, "배포 병목 이벤트 정리 버튼을 누르지 못했습니다");
    const preview = await previewRequest;
    assert.equal(preview.request.method, "GET", "정리 확인 전에 GET 미리보기를 요청하지 않았습니다");
    await cdp.send("Fetch.fulfillRequest", {
      requestId: preview.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify({
        retention_days: 30,
        deleted_count: 5,
        retained_event_count: 79,
        oldest_event_at: null,
        newest_event_at: null,
      })).toString("base64"),
    });
    await waitForCondition(
      cdp,
      `window.__tmCleanupConfirmMessages?.length === 1`,
      timeoutMs,
      "배포 병목 이벤트 정리 확인창이 호출되지 않았습니다",
    );
    await evaluate(cdp, `new Promise((resolve) => setTimeout(resolve, 250))`);
    const snapshot = await evaluate(cdp, `({
      methods: window.__tmCleanupMethods,
      message: window.__tmCleanupConfirmMessages[0],
    })`);
    assert.deepEqual(snapshot.methods, ["GET"], "정리 취소 뒤 변경 요청이 발생했습니다");
    assert.match(snapshot.message, /30일.*5건.*79건.*계속하시겠습니까/);
  } finally {
    await cdp.send("Fetch.disable");
    await evaluate(cdp, `(() => {
      if (window.__tmOriginalXhrOpen) XMLHttpRequest.prototype.open = window.__tmOriginalXhrOpen;
      if (window.__tmOriginalConfirm) window.confirm = window.__tmOriginalConfirm;
      delete window.__tmCleanupMethods;
      delete window.__tmCleanupConfirmMessages;
      delete window.__tmOriginalXhrOpen;
      delete window.__tmOriginalConfirm;
    })()`);
  }
  return true;
}

export function resolveOptionalAdminCredentials(env = process.env) {
  const username = env.TM_SMOKE_ADMIN_USERNAME;
  const password = env.TM_SMOKE_ADMIN_PASSWORD;
  if (!username && !password) return null;
  if (!username || !password) {
    throw new Error("TM_SMOKE_ADMIN_USERNAME과 TM_SMOKE_ADMIN_PASSWORD를 함께 지정해야 합니다");
  }
  return { username, password };
}

export function runDeploymentBottleneckCleanupSelfTest() {
  assert.equal(resolveOptionalAdminCredentials({}), null);
  assert.deepEqual(
    resolveOptionalAdminCredentials({
      TM_SMOKE_ADMIN_USERNAME: "smoke-admin",
      TM_SMOKE_ADMIN_PASSWORD: "secret",
    }),
    { username: "smoke-admin", password: "secret" },
  );
  assert.throws(
    () => resolveOptionalAdminCredentials({ TM_SMOKE_ADMIN_USERNAME: "smoke-admin" }),
    /함께 지정/,
  );
}

async function navigateAndWait(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

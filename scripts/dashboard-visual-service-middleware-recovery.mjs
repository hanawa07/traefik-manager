import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";

const INITIAL_REQUEST_ATTEMPTS = 2;

export async function checkServiceMiddlewareRequestRecovery({
  baseUrl,
  cdp,
  timeoutMs,
}) {
  const fixtures = await evaluate(cdp, `(async () => {
    const [services, middlewares] = await Promise.all([
      fetch('/api/v1/services'),
      fetch('/api/v1/middlewares'),
    ]);
    return {
      middlewares: middlewares.ok ? await middlewares.json() : null,
      services: services.ok ? await services.json() : null,
    };
  })()`);
  assert.ok(Array.isArray(fixtures.services), "서비스 복구 fixture를 읽지 못했습니다");
  assert.ok(Array.isArray(fixtures.middlewares), "미들웨어 복구 fixture를 읽지 못했습니다");

  await checkRequestRecovery({
    baseUrl,
    cdp,
    endpoint: "/api/v1/services",
    errorSelector: '[data-testid="services-list-error"]',
    fixture: fixtures.services,
    pagePath: "/dashboard/services",
    recoveryExpression:
      `!document.querySelector('[data-testid="services-list-error"]') && ` +
      `!document.body.innerText.includes('확인 실패')`,
    retrySelector: '[data-testid="services-list-retry"]',
    timeoutMs,
  });
  await checkRequestRecovery({
    baseUrl,
    cdp,
    endpoint: "/api/v1/middlewares",
    errorSelector: '[data-testid="middleware-templates-error"]',
    fixture: fixtures.middlewares,
    pagePath: "/dashboard/middlewares",
    recoveryExpression:
      `!document.querySelector('[data-testid="middleware-templates-error"]') && ` +
      `document.body.innerText.includes('공유 미들웨어 템플릿')`,
    retrySelector: '[data-testid="middleware-templates-retry"]',
    timeoutMs,
  });
}

async function checkRequestRecovery({
  baseUrl,
  cdp,
  endpoint,
  errorSelector,
  fixture,
  pagePath,
  recoveryExpression,
  retrySelector,
  timeoutMs,
}) {
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: `*${endpoint}` }],
  });
  try {
    let requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}${pagePath}` });
    for (let attempt = 0; attempt < INITIAL_REQUEST_ATTEMPTS; attempt += 1) {
      const request = await requestPaused;
      assert.equal(new URL(request.request.url).pathname, endpoint);
      requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
      await fulfillNotFound(cdp, request);
    }
    await loaded;
    await waitForCondition(
      cdp,
      `document.querySelector(${JSON.stringify(errorSelector)})?.textContent?.includes('Not Found')`,
      timeoutMs,
      `${pagePath}: 404 오류 상태가 표시되지 않았습니다`,
    );

    const clicked = await evaluate(cdp, `(() => {
      const button = document.querySelector(${JSON.stringify(retrySelector)});
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    assert.equal(clicked, true, `${pagePath}: 다시 시도 버튼을 누르지 못했습니다`);
    const retryRequest = await requestPaused;
    await fulfillJsonRequest(cdp, retryRequest, fixture);
    await waitForCondition(
      cdp,
      recoveryExpression,
      timeoutMs,
      `${pagePath}: 다시 시도 후 정상 화면으로 복구되지 않았습니다`,
    );
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
  }
}

async function fulfillNotFound(cdp, request) {
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 404,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify({ detail: "Not Found" })).toString("base64"),
  });
}

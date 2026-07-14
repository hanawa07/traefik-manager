import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerHttpLogStorageWarnings({ cdp, timeoutMs }) {
  const response = await evaluate(cdp, `(async () => {
    const result = await fetch('/api/v1/docker/http-errors?window_hours=24', {
      credentials: 'include',
      cache: 'no-store',
    });
    return { body: await result.json(), ok: result.ok };
  })()`);
  assert.equal(response.ok, true, "Manager API 로그 보관 fixture 원본을 읽지 못했습니다");
  assert.equal(response.body.buckets?.length, 24, "Manager API 로그 보관 fixture 원본 구간이 다릅니다");

  await showWarningFixture({
    cdp,
    fixture: buildFixture(response.body, 6, {
      ...response.body.log_storage,
      source: "persistent",
      size_bytes: 800,
      capacity_bytes: 1_000,
    }),
    expectedKind: "capacity",
    expectedText: "영속 로그 용량이 80% 이상입니다",
    timeoutMs,
    windowHours: "6",
  });
  await showWarningFixture({
    cdp,
    fixture: buildFixture(response.body, 12, {
      ...response.body.log_storage,
      source: "docker",
      size_bytes: 200,
      capacity_bytes: 1_000,
    }),
    expectedKind: "docker",
    expectedText: "Docker 로그로 대체 중입니다",
    timeoutMs,
    windowHours: "12",
  });

  await setWindowValue(cdp, "24");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-window-hours') === '24' && document.querySelectorAll('[data-http-error-bucket="true"]').length === 24`,
    timeoutMs,
    "Manager API 로그 보관 fixture 후 24시간 조건이 복원되지 않았습니다",
  );
}

function buildFixture(summary, windowHours, storage) {
  return {
    ...summary,
    window_hours: windowHours,
    buckets: summary.buckets.slice(-windowHours),
    log_storage: storage,
  };
}

async function showWarningFixture({
  cdp,
  expectedKind,
  expectedText,
  fixture,
  timeoutMs,
  windowHours,
}) {
  await cdp.send("Fetch.enable", {
    patterns: [
      {
        requestStage: "Request",
        urlPattern: `*/api/v1/docker/http-errors\\?window_hours=${windowHours}*`,
      },
    ],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    await setWindowValue(cdp, windowHours);
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    });
    await waitForCondition(
      cdp,
      `document.querySelector('[data-testid="manager-http-log-storage"]')?.getAttribute('data-log-warning') === ${JSON.stringify(expectedKind)}`,
      timeoutMs,
      `Manager API 로그 보관 ${expectedKind} 경고가 표시되지 않았습니다`,
    );
    const warningText = await evaluate(
      cdp,
      `document.querySelector('[data-testid="manager-http-log-storage-warning"]')?.textContent || ''`,
    );
    assert.match(warningText, new RegExp(expectedText));
    const auditHref = await evaluate(
      cdp,
      `document.querySelector('[data-testid="manager-http-log-storage-audit-link"]')?.getAttribute('href') || ''`,
    );
    assert.equal(
      auditHref,
      "/dashboard/audit?filter=manager_health&manager_source=api&period=1&q=request-log-storage&expand=latest",
      "Manager 요청 로그 보관 경고의 감사 이력 링크가 올바르지 않습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }
}

async function setWindowValue(cdp, value) {
  const changed = await evaluate(cdp, `(() => {
    const element = document.querySelector('[data-testid="manager-http-error-window"]');
    if (!(element instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager API 오류 추이 기간을 바꾸지 못했습니다");
}

import assert from "node:assert/strict";

import {
  captureVisualDom,
  captureVisualScreenshot,
} from "./dashboard-visual-artifacts.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkTraefikAlertRetryAdminFixture } from "./dashboard-visual-traefik-alert-retry.mjs";

export async function checkAdminVisualFixtures(options) {
  await checkSmokeRateLimitAdminFixture(options);
  return checkTraefikAlertRetryAdminFixture(options);
}

async function checkSmokeRateLimitAdminFixture({
  artifactDir,
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
    const fixture = await evaluate(cdp, `(async () => {
      const response = await fetch('/api/v1/settings/smoke-rotation');
      if (!response.ok) return null;
      return response.json();
    })()`);
    assert.ok(fixture, "관리자 운영 점검 fixture를 읽지 못했습니다");
    fixture.monitoring_github_rate_limit_remaining = 10;
    fixture.monitoring_github_rate_limit_limit = 60;
    fixture.monitoring_github_rate_limit_reset_at = new Date(Date.now() + 5_000).toISOString();

    await cdp.send("Fetch.enable", {
      patterns: [{
        requestStage: "Request",
        urlPattern: "*/api/v1/settings/smoke-rotation*",
      }],
    });
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}/dashboard/settings` });
    const request = await requestPaused;
    assert.equal(request.request.method, "GET");
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    });
    await loaded;

    await waitForCondition(
      cdp,
      `(() => {
        const button = document.querySelector('[data-testid="smoke-history-refresh"]');
        const warning = document.querySelector('[data-testid="smoke-github-rate-limit-warning"]');
        return button instanceof HTMLButtonElement && button.disabled &&
          warning?.textContent?.includes('수동 새로고침과 자동 결과 확인을 잠갔습니다');
      })()`,
      timeoutMs,
      "관리자 GitHub API 새로고침 버튼이 잠기지 않았습니다",
    );
    await waitForCondition(
      cdp,
      `(() => {
        const button = document.querySelector('[data-testid="smoke-history-refresh"]');
        const warning = document.querySelector('[data-testid="smoke-github-rate-limit-warning"]');
        const tracking = document.querySelector('[data-testid="smoke-manual-tracking-status"]');
        return button instanceof HTMLButtonElement && !button.disabled && !warning &&
          tracking?.textContent?.includes('링크를 열면 새 실행 결과를 6분간 자동 확인합니다');
      })()`,
      timeoutMs,
      "GitHub API 초기화 후 관리자 새로고침 버튼이 자동 해제되지 않았습니다",
    );
  } catch (error) {
    await Promise.allSettled([
      captureVisualScreenshot({ artifactDir, cdp, name: "admin-smoke-rate-limit-failure" }),
      captureVisualDom({ artifactDir, cdp, name: "admin-smoke-rate-limit-failure" }),
    ]);
    throw error;
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}

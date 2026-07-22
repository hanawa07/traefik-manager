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
    fixture.monitoring_github_rate_limit_remaining = 42;
    fixture.monitoring_github_rate_limit_limit = 60;
    fixture.monitoring_github_rate_limit_reset_at = new Date(Date.now() + 60 * 60_000).toISOString();
    fixture.monitoring_github_secondary_limit_retry_at = new Date(Date.now() + 5_000).toISOString();
    fixture.monitoring_github_refresh_reserve = 8;
    fixture.monitoring_github_history_cache_items = 7;
    fixture.monitoring_github_history_cache_capacity = 200;
    fixture.monitoring_github_history_cache_hits = 3;
    fixture.monitoring_github_history_cache_misses = 1;
    fixture.monitoring_github_last_request_count = 6;
    fixture.monitoring_github_last_workflow_request_count = 1;
    fixture.monitoring_github_last_job_request_count = 4;
    fixture.monitoring_github_last_artifact_request_count = 1;

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
        const cache = document.querySelector('[data-testid="smoke-github-cache-diagnostics"]');
        const estimate = document.querySelector('[data-testid="smoke-github-request-estimate"]');
        const auditLink = document.querySelector('[data-testid="smoke-github-audit-link"]');
        const auditSummary = document.querySelector('[data-testid="smoke-github-rate-limit-audit-summary"]');
        const alertTest = document.querySelector('[data-testid="smoke-github-rate-limit-alert-test"]');
        const alertSuccess = document.querySelector('[data-testid="smoke-github-rate-limit-alert-last-success"]');
        return button instanceof HTMLButtonElement && button.disabled &&
          alertTest instanceof HTMLButtonElement && !alertTest.disabled &&
          alertTest.textContent?.includes('운영 경로 테스트') &&
          alertSuccess?.textContent?.includes('최근 제한 알림 테스트 성공') &&
          warning?.textContent?.includes('GitHub API 보조 제한으로 새로고침을 잠갔습니다') &&
          document.querySelector('[data-testid="smoke-github-rate-limit"]')?.textContent?.includes('보호 기준 8회') &&
          cache?.textContent?.includes('응답 캐시 7/200개 · 적중률 75% (3/4회)') &&
          estimate?.textContent?.includes('Workflow 1회 · Job 4회 · Artifact 1회') &&
          estimate?.textContent?.includes('지금 새로고침 약 6회') &&
          auditSummary?.getAttribute('data-status') === 'ready' &&
          auditSummary?.textContent?.includes('전체 누적') &&
          auditLink?.getAttribute('href') === '/dashboard/audit?filter=github_api_rate_limit';
      })()`,
      timeoutMs,
      "관리자 GitHub API 보조 제한·진단 표시를 확인하지 못했습니다",
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

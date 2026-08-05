import assert from "node:assert/strict";

import {
  captureVisualDom,
  captureVisualScreenshot,
} from "./dashboard-visual-artifacts.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkServiceGatewayImportAdminFixture } from "./dashboard-visual-service-gateway-import.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";
import { checkSmokeLocalRunFilters } from "./dashboard-visual-smoke-statistics-history.mjs";
import { checkTraefikAlertRetryAdminFixture } from "./dashboard-visual-traefik-alert-retry.mjs";

export async function checkAdminVisualFixtures(options) {
  await checkSmokeHistoryAdminReadOnly(options);
  await checkSmokeHistoryRetryAdminFixture(options);
  await checkServiceGatewayImportAdminFixture(options);
  await checkSmokeRateLimitAdminFixture(options);
  return checkTraefikAlertRetryAdminFixture(options);
}

async function checkSmokeHistoryRetryAdminFixture({
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
      return response.ok ? response.json() : null;
    })()`);
    assert.ok(fixture, "GitHub 통계 재확인 fixture를 읽지 못했습니다");
    const readyFixture = {
      ...fixture,
      monitoring_history_data_checked_at: "2026-07-20T06:00:00Z",
      monitoring_history_error: null,
    };
    const errorFixture = {
      ...readyFixture,
      monitoring_history_error: "GitHub API 임시 오류",
    };

    await cdp.send("Fetch.enable", {
      patterns: [{
        requestStage: "Request",
        urlPattern: "*/api/v1/settings/smoke-rotation*",
      }],
    });
    const initialRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}/dashboard` });
    const initialPaused = await initialRequest;
    assert.match(initialPaused.request.url, /summary=true/);
    await fulfillJsonRequest(cdp, initialPaused, errorFixture);
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const retry = document.querySelector('[data-testid="smoke-history-retry"]');
        const detail = document.querySelector('[data-testid="smoke-history-error-detail"]');
        return retry instanceof HTMLButtonElement && !retry.disabled &&
          retry.textContent?.includes('즉시 재확인') &&
          detail?.textContent?.includes('GitHub API 임시 오류');
      })()`,
      timeoutMs,
      "GitHub 통계 오류의 즉시 재확인 버튼이 표시되지 않았습니다",
    );

    const refreshRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const retryClicked = await evaluate(cdp, `(() => {
      const retry = document.querySelector('[data-testid="smoke-history-retry"]');
      if (!(retry instanceof HTMLButtonElement) || retry.disabled) return false;
      retry.click();
      return true;
    })()`);
    assert.equal(retryClicked, true, "GitHub 통계 즉시 재확인 버튼을 누르지 못했습니다");
    const refreshPaused = await refreshRequest;
    assert.match(refreshPaused.request.url, /refresh_monitoring_history=true/);
    const summaryRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    await fulfillJsonRequest(cdp, refreshPaused, readyFixture);
    const summaryPaused = await summaryRequest;
    assert.match(summaryPaused.request.url, /summary=true/);
    await fulfillJsonRequest(cdp, summaryPaused, readyFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const trend = document.querySelector('[data-testid="smoke-run-trend"]');
        return trend?.getAttribute('data-smoke-history-state') === 'ready' &&
          !trend.querySelector('[data-testid="smoke-history-error-detail"]') &&
          !trend.querySelector('[data-testid="smoke-history-retry"]');
      })()`,
      timeoutMs,
      "GitHub 통계 재확인 후 오류 표시가 해제되지 않았습니다",
    );
  } catch (error) {
    await Promise.allSettled([
      captureVisualScreenshot({ artifactDir, cdp, name: "admin-smoke-history-retry-failure" }),
      captureVisualDom({ artifactDir, cdp, name: "admin-smoke-history-retry-failure" }),
    ]);
    throw error;
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}

export function runAdminVisualFixturesSelfTest() {
  assert.equal(shouldRequirePositiveGithubRunCount("ready"), true);
  assert.equal(shouldRequirePositiveGithubRunCount("error"), false);
  assert.throws(
    () => shouldRequirePositiveGithubRunCount(null),
    /GitHub 실행 통계 상태를 확인하지 못했습니다/,
  );
}

async function checkSmokeHistoryAdminReadOnly({
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
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}/dashboard` });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const trend = document.querySelector('[data-testid="smoke-run-trend"]');
        const counts = document.querySelector('[data-testid="smoke-run-status-counts"]');
        const thirty = Array.from(trend?.querySelectorAll('button') || []).find(
          (button) => button.textContent?.trim() === '30일'
        );
        const history = document.querySelector('[data-testid="smoke-statistics-history"]');
        const failure = history?.querySelector(
          'select[aria-label="로컬 스모크 실행 결과 필터"] option[value="failure"]'
        );
        const historyState = trend?.getAttribute('data-smoke-history-state');
        const errorDetail = trend?.querySelector('[data-testid="smoke-history-error-detail"]');
        return (historyState === 'ready' || historyState === 'error') &&
          (historyState !== 'error' || errorDetail instanceof HTMLElement) &&
          thirty instanceof HTMLButtonElement && counts instanceof HTMLElement &&
          Number(history?.getAttribute('data-local-run-visible-count')) > 0 &&
          failure instanceof HTMLOptionElement;
      })()`,
      timeoutMs,
      "관리자 GitHub 실행 통계와 로컬 콜백 이력을 확인하지 못했습니다",
    );
    await evaluate(cdp, `Array.from(
      document.querySelectorAll('[data-testid="smoke-run-trend"] button')
    ).find((button) => button.textContent?.trim() === '30일')?.click()`);
    await waitForCondition(
      cdp,
      `Array.from(
        document.querySelectorAll('[data-testid="smoke-run-trend"] button')
      ).find((button) => button.textContent?.trim() === '30일')?.getAttribute('aria-pressed') === 'true'`,
      timeoutMs,
      "관리자 GitHub 실행 통계가 30일 범위로 전환되지 않았습니다",
    );
    const historyState = await evaluate(cdp, `document.querySelector(
      '[data-testid="smoke-run-trend"]'
    )?.getAttribute('data-smoke-history-state')`);
    if (shouldRequirePositiveGithubRunCount(historyState)) {
      await waitForCondition(
        cdp,
        `/30일 전체 [1-9][0-9]*건/.test(
          document.querySelector('[data-testid="smoke-run-status-counts"]')?.textContent || ''
        )`,
        timeoutMs,
        "관리자 GitHub 30일 실행 통계가 표시되지 않았습니다",
      );
    } else {
      const errorDetail = await evaluate(cdp, `document.querySelector(
        '[data-testid="smoke-history-error-detail"]'
      )?.textContent`);
      assert.match(
        errorDetail || "",
        /캐시 기준|사용 가능한 캐시 없음/,
        "GitHub 실행 통계 오류의 캐시 기준이 표시되지 않았습니다",
      );
    }
    const failureCount = await evaluate(cdp, `Number(document.querySelector(
      '[data-testid="smoke-statistics-history"] select[aria-label="로컬 스모크 실행 결과 필터"] option[value="failure"]'
    )?.getAttribute('data-count') || 0)`);
    const selected = await checkSmokeLocalRunFilters(cdp, timeoutMs, "failure");
    if (failureCount > 0) {
      assert.equal(selected.status, "failure", "관리자 실패 콜백 필터가 선택되지 않았습니다");
    }
  } catch (error) {
    await Promise.allSettled([
      captureVisualScreenshot({ artifactDir, cdp, name: "admin-smoke-history-failure" }),
      captureVisualDom({ artifactDir, cdp, name: "admin-smoke-history-failure" }),
    ]);
    throw error;
  } finally {
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}

function shouldRequirePositiveGithubRunCount(historyState) {
  assert.ok(
    historyState === "ready" || historyState === "error",
    "GitHub 실행 통계 상태를 확인하지 못했습니다",
  );
  return historyState === "ready";
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
        const primarySuccess = document.querySelector('[data-testid="smoke-github-primary-rate-limit-operational-last-success"]');
        const secondarySuccess = document.querySelector('[data-testid="smoke-github-secondary-rate-limit-operational-last-success"]');
        const primaryNextAlertAt = document.querySelector('[data-testid="smoke-github-primary-rate-limit-next-alert-at"]');
        const secondaryNextAlertAt = document.querySelector('[data-testid="smoke-github-secondary-rate-limit-next-alert-at"]');
        return button instanceof HTMLButtonElement && button.disabled &&
          alertTest instanceof HTMLButtonElement && !alertTest.disabled &&
          alertTest.textContent?.includes('운영 경로 테스트') &&
          alertSuccess?.textContent?.includes('최근 제한 알림 테스트 성공') &&
          primarySuccess?.textContent?.includes('기본 제한 운영 알림 성공') &&
          secondarySuccess?.textContent?.includes('보조 제한 운영 알림 성공') &&
          primaryNextAlertAt?.textContent?.includes('기본 제한 다음 재알림 가능') &&
          secondaryNextAlertAt?.textContent?.includes('보조 제한 다음 재알림 가능') &&
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

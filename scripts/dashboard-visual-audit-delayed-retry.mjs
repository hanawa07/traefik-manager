import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkAuditDelayedRetryFilter({ cdp, timeoutMs }) {
  await checkDelayedRetryTrend(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('[data-audit-filter="delayed_retry"]')?.getAttribute('data-audit-count') !== null`,
    timeoutMs,
    "지연 재시도 감사 건수를 불러오지 못했습니다",
  );
  const summary = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit?retry_delay=delayed&limit=1&offset=0');
    const button = document.querySelector('[data-audit-filter="delayed_retry"]');
    return {
      apiCount: Number(response.headers.get('x-total-count')),
      apiOk: response.ok,
      buttonCount: Number(button?.getAttribute('data-audit-count')),
      buttonText: button?.textContent || '',
    };
  })()`);
  assert.equal(summary.apiOk, true, "지연 재시도 감사 API 응답을 받지 못했습니다");
  assert.equal(summary.buttonCount, summary.apiCount, "지연 재시도 필터 건수가 API와 다릅니다");
  assert.ok(summary.buttonText.includes(`(${summary.apiCount})`), "지연 재시도 필터에 건수가 없습니다");

  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-audit-filter="delayed_retry"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "지연 재시도 감사 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'delayed_retry' &&
      document.querySelector('[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-total') === ${JSON.stringify(String(summary.apiCount))}`,
    timeoutMs,
    "지연 재시도 필터 결과와 URL이 반영되지 않았습니다",
  );
  const exportMatches = await evaluate(cdp, `(() => {
    const link = Array.from(document.querySelectorAll('a')).find(
      (item) => item.textContent?.includes('현재 조건 CSV')
    );
    return link ? new URL(link.href).searchParams.get('retry_delay') === 'delayed' : false;
  })()`);
  assert.equal(exportMatches, true, "지연 재시도 조건이 CSV 링크에 반영되지 않았습니다");
  await clickAriaLabel(cdp, "감사 필터 전체 초기화");
}

async function checkDelayedRetryTrend(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `[1, 7, 30].every((days) =>
      document.querySelector('[data-testid="audit-delayed-retry-trend"] [data-period-days="' + days + '"]')
        ?.getAttribute('data-total') !== ''
    )`,
    timeoutMs,
    "지연 재시도 기간별 추이를 불러오지 못했습니다",
  );
  const summary = await evaluate(cdp, `(async () => {
    const periods = [1, 7, 30];
    const apiCounts = await Promise.all(periods.map(async (days) => {
      const response = await fetch('/api/v1/audit?retry_delay=delayed&limit=1&period_days=' + days);
      return { ok: response.ok, total: Number(response.headers.get('x-total-count')) };
    }));
    const uiCounts = periods.map((days) => Number(
      document.querySelector('[data-testid="audit-delayed-retry-trend"] [data-period-days="' + days + '"]')
        ?.getAttribute('data-total')
    ));
    return { apiCounts, uiCounts };
  })()`);
  assert.ok(summary.apiCounts.every((item) => item.ok), "지연 재시도 추이 API 응답을 받지 못했습니다");
  assert.deepEqual(
    summary.uiCounts,
    summary.apiCounts.map((item) => item.total),
    "지연 재시도 추이 건수가 API와 다릅니다",
  );
  assert.ok(
    summary.uiCounts[0] <= summary.uiCounts[1] && summary.uiCounts[1] <= summary.uiCounts[2],
    "지연 재시도 누적 건수 순서가 올바르지 않습니다",
  );

  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      '[data-testid="audit-delayed-retry-trend"] [data-period-days="7"]'
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "7일 지연 재시도 추이 카드를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'delayed_retry' &&
      new URLSearchParams(location.search).get('period') === '7' &&
      document.querySelector('[data-period-days="7"]')?.getAttribute('aria-pressed') === 'true' &&
      document.querySelector('[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-total') ===
        ${JSON.stringify(String(summary.apiCounts[1].total))}`,
    timeoutMs,
    "7일 지연 재시도 추이 필터가 표와 URL에 반영되지 않았습니다",
  );
  const exportMatches = await evaluate(cdp, `(() => {
    const link = Array.from(document.querySelectorAll('a')).find(
      (item) => item.textContent?.includes('현재 조건 CSV')
    );
    if (!link) return false;
    const params = new URL(link.href).searchParams;
    return params.get('retry_delay') === 'delayed' && params.get('period_days') === '7';
  })()`);
  assert.equal(exportMatches, true, "7일 지연 재시도 조건이 CSV 링크에 반영되지 않았습니다");
  await clickAriaLabel(cdp, "감사 필터 전체 초기화");
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has('filter') &&
      !new URLSearchParams(location.search).has('period')`,
    timeoutMs,
    "지연 재시도 추이 필터가 초기화되지 않았습니다",
  );
}

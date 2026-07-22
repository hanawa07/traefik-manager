import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkAuditGithubApiRateLimitTrend({ cdp, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-audit-filter="github_api_rate_limit"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "GitHub API 제한 감사 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'github_api_rate_limit' &&
      [1, 7, 30, 90].every((days) => {
        const card = document.querySelector(
          '[data-testid="audit-github-api-rate-limit-trend"] [data-period-days="' + days + '"]'
        );
        return card?.getAttribute('data-primary') !== '' &&
          card?.getAttribute('data-secondary') !== '' &&
          card?.getAttribute('data-total') !== '';
      })`,
    timeoutMs,
    "GitHub API 제한 기간별 추이를 불러오지 못했습니다",
  );

  const summary = await evaluate(cdp, `(async () => {
    const periods = [1, 7, 30, 90];
    const counts = await Promise.all(periods.map(async (days) => {
      const [primary, secondary, grouped] = await Promise.all([
        fetch('/api/v1/audit?event=github_api_primary_rate_limit&limit=1&period_days=' + days),
        fetch('/api/v1/audit?event=github_api_secondary_rate_limit&limit=1&period_days=' + days),
        fetch('/api/v1/audit?event=github_api_rate_limit&limit=1&period_days=' + days),
      ]);
      return {
        days,
        ok: primary.ok && secondary.ok && grouped.ok,
        primary: Number(primary.headers.get('x-total-count')),
        secondary: Number(secondary.headers.get('x-total-count')),
        total: Number(grouped.headers.get('x-total-count')),
      };
    }));
    const ui = periods.map((days) => {
      const card = document.querySelector(
        '[data-testid="audit-github-api-rate-limit-trend"] [data-period-days="' + days + '"]'
      );
      return {
        days,
        primary: Number(card?.getAttribute('data-primary')),
        secondary: Number(card?.getAttribute('data-secondary')),
        total: Number(card?.getAttribute('data-total')),
      };
    });
    return { counts, ui };
  })()`);
  assert.ok(summary.counts.every((item) => item.ok), "GitHub API 제한 추이 API 응답을 받지 못했습니다");
  assert.deepEqual(summary.ui, summary.counts.map(({ days, primary, secondary, total }) => ({
    days,
    primary,
    secondary,
    total,
  })), "GitHub API 제한 추이 건수가 API와 다릅니다");
  assert.ok(
    summary.ui.every((item) => item.primary + item.secondary === item.total),
    "GitHub API 제한 기본·보조 합계가 전체 건수와 다릅니다",
  );

  await clickAriaLabel(cdp, "7일 GitHub API 제한 필터 적용");
  const weekTotal = summary.counts.find((item) => item.days === 7)?.total;
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'github_api_rate_limit' &&
      new URLSearchParams(location.search).get('period') === '7' &&
      document.querySelector('[data-testid="audit-github-api-rate-limit-trend"] [data-period-days="7"]')
        ?.getAttribute('aria-pressed') === 'true' &&
      document.querySelector('[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-total') ===
        ${JSON.stringify(String(weekTotal))}`,
    timeoutMs,
    "7일 GitHub API 제한 필터가 표와 URL에 반영되지 않았습니다",
  );
  const exportMatches = await evaluate(cdp, `(() => {
    const link = Array.from(document.querySelectorAll('a')).find(
      (item) => item.textContent?.includes('현재 조건 CSV')
    );
    if (!link) return false;
    const params = new URL(link.href).searchParams;
    return params.get('event') === 'github_api_rate_limit' && params.get('period_days') === '7';
  })()`);
  assert.equal(exportMatches, true, "GitHub API 제한 조건이 CSV 링크에 반영되지 않았습니다");

  await setDateInput(cdp, "감사 시작일", "2020-01-01");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('start_date') === '2020-01-01'`,
    timeoutMs,
    "GitHub API 제한 사용자 지정 시작일이 반영되지 않았습니다",
  );
  await setDateInput(cdp, "감사 종료일", "2099-12-31");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const card = document.querySelector('[data-testid="audit-github-api-rate-limit-custom-range"]');
      return params.get('start_date') === '2020-01-01' &&
        params.get('end_date') === '2099-12-31' &&
        !params.has('period') &&
        card?.getAttribute('data-loading') === 'false' &&
        card?.getAttribute('data-primary') !== '' &&
        card?.getAttribute('data-secondary') !== '' &&
        card?.getAttribute('data-total') !== '';
    })()`,
    timeoutMs,
    "GitHub API 제한 사용자 지정 기간 추이를 불러오지 못했습니다",
  );
  const customRange = await evaluate(cdp, `(async () => {
    const query = 'start_date=2020-01-01&end_date=2099-12-31&limit=1';
    const [primary, secondary] = await Promise.all([
      fetch('/api/v1/audit?event=github_api_primary_rate_limit&' + query),
      fetch('/api/v1/audit?event=github_api_secondary_rate_limit&' + query),
    ]);
    const card = document.querySelector('[data-testid="audit-github-api-rate-limit-custom-range"]');
    return {
      ok: primary.ok && secondary.ok,
      apiPrimary: Number(primary.headers.get('x-total-count')),
      apiSecondary: Number(secondary.headers.get('x-total-count')),
      uiPrimary: Number(card?.getAttribute('data-primary')),
      uiSecondary: Number(card?.getAttribute('data-secondary')),
      uiTotal: Number(card?.getAttribute('data-total')),
    };
  })()`);
  assert.equal(customRange.ok, true, "GitHub API 제한 사용자 지정 기간 API 응답을 받지 못했습니다");
  assert.deepEqual(
    [customRange.uiPrimary, customRange.uiSecondary, customRange.uiTotal],
    [
      customRange.apiPrimary,
      customRange.apiSecondary,
      customRange.apiPrimary + customRange.apiSecondary,
    ],
    "GitHub API 제한 사용자 지정 기간 건수가 API와 다릅니다",
  );
  await clickAriaLabel(cdp, "감사 필터 전체 초기화");
}

async function setDateInput(cdp, ariaLabel, value) {
  const updated = await evaluate(cdp, `(() => {
    const input = document.querySelector('input[aria-label=${JSON.stringify(ariaLabel)}]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(updated, true, `${ariaLabel} 입력을 찾지 못했습니다`);
}

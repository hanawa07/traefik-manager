import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkAuditDelayedRetryFilter({ cdp, timeoutMs }) {
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

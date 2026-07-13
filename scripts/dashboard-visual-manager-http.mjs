import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerHttpErrorTrend({ cdp, timeoutMs = 15_000 }) {
  const snapshot = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="manager-http-error-trend"]');
    const chart = document.querySelector('[data-testid="manager-http-error-chart-scroll"]');
    return card ? {
      available: card.getAttribute('data-http-error-available'),
      bucketCount: card.querySelectorAll('[data-http-error-bucket="true"]').length,
      chartScrollWidth: chart?.scrollWidth ?? 0,
      chartWidth: chart?.clientWidth ?? 0,
      text: card.textContent || '',
    } : null;
  })()`);

  assert.ok(snapshot, "Manager API 오류 추이 카드를 찾지 못했습니다");
  assert.equal(snapshot.available, "true", "Manager API 오류 로그를 조회하지 못했습니다");
  assert.equal(snapshot.bucketCount, 24, "Manager API 오류 추이가 24개 시간 구간이 아닙니다");
  assert.ok(snapshot.chartScrollWidth >= snapshot.chartWidth, "Manager API 오류 차트 폭이 올바르지 않습니다");
  assert.match(snapshot.text, /관측 시작:/, "Manager API 오류 로그 관측 시각이 없습니다");

  await setSelectValue(cdp, '[data-testid="manager-http-error-window"]', "6");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-window-hours') === '6' && document.querySelectorAll('[data-http-error-bucket="true"]').length === 6`,
    timeoutMs,
    "Manager API 오류 추이가 6시간 조건으로 갱신되지 않았습니다",
  );
  await setInputValue(cdp, '[data-testid="manager-http-error-path-filter"]', "services");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-path-filter') === 'services'`,
    timeoutMs,
    "Manager API 오류 경로 필터가 적용되지 않았습니다",
  );
  await setInputValue(cdp, '[data-testid="manager-http-error-path-filter"]', "");
  await setSelectValue(cdp, '[data-testid="manager-http-error-window"]', "24");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="manager-http-error-trend"]')?.getAttribute('data-http-error-window-hours') === '24' && document.querySelectorAll('[data-http-error-bucket="true"]').length === 24`,
    timeoutMs,
    "Manager API 오류 추이가 기본 24시간 조건으로 복원되지 않았습니다",
  );
}

async function setSelectValue(cdp, selector, value) {
  const changed = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${selector}: select를 찾지 못했습니다`);
}

async function setInputValue(cdp, selector, value) {
  const changed = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${selector}: input을 찾지 못했습니다`);
}

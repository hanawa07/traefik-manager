import assert from "node:assert/strict";

import {
  clickAriaLabel,
  evaluate,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

export async function assertAuditPagination(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('nav[aria-label="감사 로그 페이지"]'))`,
    timeoutMs,
    "감사 로그 페이지네이션이 표시되지 않았습니다",
  );
  const snapshot = await evaluate(cdp, `(() => {
    const nav = document.querySelector('nav[aria-label="감사 로그 페이지"]');
    const total = Number(nav?.getAttribute('data-audit-total'));
    const next = document.querySelector('button[aria-label="다음 감사 로그 페이지"]');
    return { nextDisabled: next?.disabled, total };
  })()`);
  assert.ok(Number.isInteger(snapshot.total) && snapshot.total >= 0, "감사 로그 총 건수가 올바르지 않습니다");
  assert.equal(snapshot.nextDisabled, snapshot.total <= 50, "감사 로그 다음 페이지 상태가 총 건수와 맞지 않습니다");
  if (snapshot.total > 50) {
    await clickAriaLabel(cdp, "다음 감사 로그 페이지");
    await waitForAuditQueryParam(cdp, "page", "2", timeoutMs);
    await waitForCondition(
      cdp,
      `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '2' &&
        document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
      timeoutMs,
      "감사 로그 2페이지 결과가 로드되지 않았습니다",
    );
  }
  const pageSizeChanged = await evaluate(cdp, `(() => {
    const select = document.querySelector('select[aria-label="감사 로그 페이지 크기"]');
    if (!select) return false;
    select.value = '100';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(pageSizeChanged, true, "감사 로그 페이지 크기 선택을 찾지 못했습니다");
  await waitForAuditQueryParam(cdp, "page_size", "100", timeoutMs);
  await waitForAuditQueryParamAbsent(cdp, "page", timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '1' &&
      document.querySelector('select[aria-label="감사 로그 페이지 크기"]')?.value === '100' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "감사 로그 페이지 크기 변경 결과가 로드되지 않았습니다",
  );
  const targetPage = Math.min(3, Math.ceil(snapshot.total / 100));
  if (targetPage <= 1) return;
  const directPageChanged = await evaluate(cdp, `(() => {
    const input = document.querySelector('input[aria-label="감사 로그 페이지 번호"]');
    const button = document.querySelector('button[aria-label="감사 로그 페이지 이동"]');
    if (!input || !button) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${targetPage});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    return true;
  })()`);
  assert.equal(directPageChanged, true, "감사 로그 페이지 번호 이동 입력을 찾지 못했습니다");
  await waitForAuditQueryParam(cdp, "page", String(targetPage), timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '${targetPage}' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "감사 로그 직접 지정 페이지가 로드되지 않았습니다",
  );
}

export async function assertManagerCrossCount(cdp, timeoutMs) {
  const count = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit/manager-health-summary?window_minutes=1440');
    if (!response.ok) return null;
    const summary = await response.json();
    return summary.api_unhealthy_count;
  })()`);
  assert.equal(typeof count, "number", "Manager 교차 집계 API 수치를 확인하지 못했습니다");
  const expected = `(${count})`;
  await waitForCondition(
    cdp,
    `(() => {
      const source = document.querySelector('select[aria-label="Manager 소스"]');
      const status = document.querySelector('select[aria-label="Manager 상태"]');
      const sourceText = Array.from(source?.options || []).find((option) => option.value === 'api')?.textContent || '';
      const statusText = Array.from(status?.options || []).find((option) => option.value === 'unhealthy')?.textContent || '';
      return sourceText.includes(${JSON.stringify(expected)}) && statusText.includes(${JSON.stringify(expected)});
    })()`,
    timeoutMs,
    "Manager 소스와 상태의 교차 집계 수치가 일치하지 않습니다",
  );
}

export async function waitForAuditQueryParam(cdp, key, value, timeoutMs) {
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get(${JSON.stringify(key)}) === ${JSON.stringify(value)}`,
    timeoutMs,
    `감사 로그 ${key} 필터가 URL에 저장되지 않았습니다`,
  );
}

export async function waitForAuditQueryParamAbsent(cdp, key, timeoutMs) {
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has(${JSON.stringify(key)})`,
    timeoutMs,
    `감사 로그 ${key} 값이 URL에서 제거되지 않았습니다`,
  );
}

export async function changeAuditTextInput(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(`input[aria-label="${label}"]`)});
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 입력 필드를 찾지 못했습니다`);
}

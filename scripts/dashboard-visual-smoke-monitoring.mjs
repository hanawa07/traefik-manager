import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeRunTrendRange({ cdp, timeoutMs }) {
  const initial = await evaluate(cdp, `(() => {
    const trend = document.querySelector('[data-testid="smoke-run-trend"]');
    const buttons = Array.from(trend?.querySelectorAll('button') || []);
    const seven = buttons.find((button) => button.textContent?.trim() === '7일');
    const thirty = buttons.find((button) => button.textContent?.trim() === '30일');
    thirty?.click();
    return {
      sevenPressed: seven?.getAttribute('aria-pressed'),
      thirtyFound: Boolean(thirty),
    };
  })()`);
  assert.equal(initial.sevenPressed, "true", "운영 점검 추이의 기본 7일 범위가 선택되지 않았습니다");
  assert.equal(initial.thirtyFound, true, "운영 점검 추이의 30일 범위를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('[data-testid="smoke-run-trend"] button'));
      const seven = buttons.find((button) => button.textContent?.trim() === '7일');
      const thirty = buttons.find((button) => button.textContent?.trim() === '30일');
      return seven?.getAttribute('aria-pressed') === 'false' &&
        thirty?.getAttribute('aria-pressed') === 'true';
    })()`,
    timeoutMs,
    "운영 점검 추이가 30일 범위로 전환되지 않았습니다",
  );
}

export async function checkSmokeRotationAuditDetail({ cdp, timeoutMs }) {
  const filterFound = await evaluate(cdp, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === 'Secret 회전 결과'
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(filterFound, true, "Secret 회전 결과 감사 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'smoke_rotation' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "Secret 회전 감사 로그를 불러오지 못했습니다",
  );

  const failureFound = await evaluate(cdp, `(() => {
    const row = document.querySelector('tr[data-audit-event="smoke_rotation_failed"]');
    const button = Array.from(row?.querySelectorAll('button') || []).find(
      (item) => item.textContent?.trim() === '상세 보기'
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(failureFound, true, "실패한 Secret 회전 감사 로그를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const text = document.querySelector('[data-testid="smoke-rotation-audit-detail"]')?.textContent || '';
      return text.includes('실패 Secret') && text.includes('시도 횟수') && text.includes('TM_SMOKE_');
    })()`,
    timeoutMs,
    "Secret 회전 실패 상세가 표시되지 않았습니다",
  );
}

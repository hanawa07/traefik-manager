import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSecurityAlertRetryDelaySetting({ canManageSettings, cdp, timeoutMs }) {
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-testid="security-alert-retry-delay-summary"]'))`,
    timeoutMs,
    "자동 재시도 지연 설정 요약을 불러오지 못했습니다",
  );
  const summary = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/settings/security-alerts');
    const settings = response.ok ? await response.json() : null;
    const value = document.querySelector('[data-testid="security-alert-retry-delay-summary"]');
    return {
      apiOk: response.ok,
      expected: settings?.automatic_retry_delay_warning_minutes,
      displayed: Number(value?.getAttribute('data-retry-delay-warning-minutes')),
      text: value?.textContent || '',
    };
  })()`);
  assert.equal(summary.apiOk, true, "자동 재시도 지연 설정 API 응답을 받지 못했습니다");
  assert.equal(summary.displayed, summary.expected, "자동 재시도 지연 설정 요약값이 다릅니다");
  assert.match(summary.text, new RegExp(summary.expected + '분 초과'));

  const opened = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="security-alert-settings-card"]');
    const edit = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('편집')
    );
    edit?.click();
    return Boolean(edit);
  })()`);
  assert.equal(opened, canManageSettings, "세션 역할과 보안 알림 설정 편집 권한이 다릅니다");
  if (!canManageSettings) return false;
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('input[aria-label="자동 재시도 지연 판정 시간"]'))`,
    timeoutMs,
    "자동 재시도 지연 설정 입력을 불러오지 못했습니다",
  );
  const form = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="security-alert-settings-card"]');
    const input = card?.querySelector('input[aria-label="자동 재시도 지연 판정 시간"]');
    const cancel = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('취소')
    );
    const result = {
      cancelFound: Boolean(cancel),
      max: Number(input?.max),
      min: Number(input?.min),
      value: Number(input?.value),
    };
    cancel?.click();
    return result;
  })()`);
  assert.deepEqual(form, {
    cancelFound: true,
    max: 1440,
    min: 5,
    value: summary.expected,
  });
  return true;
}

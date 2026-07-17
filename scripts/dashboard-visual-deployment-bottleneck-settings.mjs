import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkDeploymentBottleneckSettingsPreview({ cdp, timeoutMs }) {
  const opened = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="deployment-bottleneck-settings-card"]');
    const edit = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('편집'),
    );
    edit?.click();
    return Boolean(edit);
  })()`);
  if (!opened) return false;

  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-testid="deployment-bottleneck-settings-card"] input[type="number"]').length === 2`,
    timeoutMs,
    "배포 병목 설정 편집 입력이 표시되지 않았습니다",
  );
  const changed = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="deployment-bottleneck-settings-card"]');
    const preview = card?.querySelector('[data-deployment-bottleneck-host-preview]');
    const input = card?.querySelector('input[type="number"]');
    const hostThresholdMs = Number(preview?.getAttribute('data-host-threshold-ms'));
    if (!preview || !(input instanceof HTMLInputElement) || !Number.isFinite(hostThresholdMs)) return false;
    const nextValue = hostThresholdMs === 1_000 ? '2' : '1';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return nextValue;
  })()`);
  assert.ok(changed, "배포 병목 단계 소요 기준을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const card = document.querySelector('[data-testid="deployment-bottleneck-settings-card"]');
      const preview = card?.querySelector('[data-deployment-bottleneck-host-preview="different"]');
      return card?.querySelector('input[type="number"]')?.value === ${JSON.stringify(changed)} &&
        preview?.textContent?.includes('호스트 현재 적용:');
    })()`,
    timeoutMs,
    "입력값과 호스트 실제 적용값의 예상 결과가 분리 표시되지 않았습니다",
  );

  await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="deployment-bottleneck-settings-card"]');
    const cancel = Array.from(card?.querySelectorAll('button') || []).find(
      (button) => button.textContent?.includes('취소'),
    );
    cancel?.click();
  })()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-testid="deployment-bottleneck-settings-card"] input[type="number"]').length === 0`,
    timeoutMs,
    "배포 병목 설정 편집을 닫지 못했습니다",
  );
  return true;
}

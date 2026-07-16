import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistoryActions({ cdp, timeoutMs }) {
  await selectPeriod({ cdp, expectedCount: 1, timeoutMs, value: "7" });
  await selectPeriod({ cdp, expectedCount: 2, timeoutMs, value: "30" });
  await checkCompareLink(cdp);
  await checkCopyButtons({ cdp, timeoutMs });
}

async function selectPeriod({ cdp, expectedCount, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-history-period]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 배포 이력 기간을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-history-period]')?.value === ${JSON.stringify(value)} &&
        document.querySelectorAll(
          '[data-history-source="archive"] li[data-deployment-status]',
        ).length === ${expectedCount} &&
        document.querySelector('[data-history-condition="period"]') &&
        params.get('deployment_period') === ${JSON.stringify(value)};
    })()`,
    timeoutMs,
    `Manager 최근 ${value}일 배포 기간 필터가 적용되지 않았습니다`,
  );
}

async function checkCompareLink(cdp) {
  const links = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-source="archive"] [data-deployment-compare]',
  )).map((link) => link.href)`);
  assert.equal(links.length, 1, "Manager 이전 버전 비교 링크 수가 다릅니다");
  assert.match(
    links[0],
    /\/compare\/v1\.38\.69\.\.\.v1\.38\.70$/,
    "Manager 이전·현재 버전 비교 URL이 올바르지 않습니다",
  );
}

async function checkCopyButtons({ cdp, timeoutMs }) {
  const buttons = await evaluate(cdp, `(() => ({
    failures: document.querySelectorAll('[data-deployment-copy="failure_reason"]').length,
    revisions: document.querySelectorAll('[data-deployment-copy="revision"]').length,
  }))()`);
  assert.deepEqual(buttons, { failures: 2, revisions: 2 });

  await installClipboardCapture(cdp);
  await clickCopyAndWait({
    cdp,
    expected: "a".repeat(40),
    kind: "revision",
    toast: "커밋 SHA 복사 완료",
    timeoutMs,
  });
  await clickCopyAndWait({
    cdp,
    expected: "=archive fixture probe failure",
    kind: "failure_reason",
    toast: "실패 원인 복사 완료",
    timeoutMs,
  });
}

async function installClipboardCapture(cdp) {
  const installed = await evaluate(cdp, `(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => { window.__managerDeploymentClipboard = value; },
        },
      });
      window.__managerDeploymentClipboard = '';
      return true;
    } catch {
      return false;
    }
  })()`);
  assert.equal(installed, true, "Manager 클립보드 캡처를 준비하지 못했습니다");
}

async function clickCopyAndWait({ cdp, expected, kind, toast, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-deployment-copy="${kind}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager ${kind} 복사 버튼을 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `window.__managerDeploymentClipboard === ${JSON.stringify(expected)} &&
      document.body.textContent?.includes(${JSON.stringify(toast)})`,
    timeoutMs,
    `Manager ${kind} 값과 복사 완료 알림이 일치하지 않습니다`,
  );
}

import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function clickP95Filter({ cdp, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-deployment-speed-filter="p95"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "Manager P95 초과 내보내기 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('deployment_speed') === 'p95' &&
      document.querySelectorAll(
        '[data-history-source="all"] li[data-deployment-status]',
      ).length === 1`,
    timeoutMs,
    "Manager P95 초과 내보내기 필터가 적용되지 않았습니다",
  );
}

export async function checkExportButtonCount(cdp, expectedCount) {
  const labels = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-export]',
  )).map((button) => button.textContent?.replace(/\\s+/g, ' ').trim())`);
  assert.deepEqual(labels, [
    `JSON 내보내기 · ${expectedCount}건`,
    `CSV 내보내기 · ${expectedCount}건`,
  ]);
}

export async function checkExportFormatHelp({ cdp, timeoutMs }) {
  const opened = await evaluate(cdp, `(() => {
    const details = document.querySelector('[data-history-export-help]');
    details?.querySelector('summary')?.click();
    return Boolean(details);
  })()`);
  assert.equal(opened, true, "Manager 배포 이력 내보내기 형식 도움말을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const details = document.querySelector('[data-history-export-help]');
      return details?.hasAttribute('open') &&
        details.textContent?.includes('metadata와 entries') &&
        details.textContent?.includes('metadata,value 블록');
    })()`,
    timeoutMs,
    "Manager 배포 이력 내보내기 형식 도움말을 펼치지 못했습니다",
  );
}

export async function waitForExportToast({ cdp, filename, filterSummary, format, timeoutMs }) {
  await waitForCondition(
    cdp,
    `document.body.textContent?.includes(${JSON.stringify(`${format} 내보내기 완료`)}) &&
      document.body.textContent?.includes(${JSON.stringify(filename)}) &&
      document.body.textContent?.includes(${JSON.stringify(filterSummary)})`,
    timeoutMs,
    `Manager ${format} 내보내기 완료 알림 내용이 올바르지 않습니다`,
  );
}

export async function captureHistoryDownload(cdp, format) {
  const result = await evaluate(cdp, `(async () => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-history-export="${format}"]`)},
    );
    if (!button) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:deployment-history-smoke'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      if (!blob) return null;
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3));
      return { bytes, filename, text: await blob.text(), type: blob.type };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(result, `Manager ${format.toUpperCase()} 내보내기를 캡처하지 못했습니다`);
  return result;
}

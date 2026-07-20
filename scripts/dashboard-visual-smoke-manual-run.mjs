import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const STORAGE_KEY = "traefik-manager:last-manual-smoke-run";
const RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/123";

export async function checkManualSmokeRunResultPersistence({ cdp, timeoutMs }) {
  await evaluate(cdp, `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify({
    completed_at: "2026-07-20T06:00:00Z",
    run_number: 123,
    run_url: RUN_URL,
    status: "success",
  }))})`);
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  await loaded;
  await waitForCondition(
    cdp,
    `(() => {
      const link = document.querySelector('[data-testid="smoke-last-manual-run"]');
      return link?.getAttribute('data-manual-run-status') === 'success' &&
        link.href === ${JSON.stringify(RUN_URL)} && link.textContent?.includes('#123');
    })()`,
    timeoutMs,
    "마지막 수동 점검 결과가 새로고침 후 복원되지 않았습니다",
  );
  const result = await evaluate(cdp, `(() => {
    const link = document.querySelector('[data-testid="smoke-last-manual-run"]');
    return {
      label: link?.closest('div')?.textContent,
      status: link?.getAttribute('data-manual-run-status'),
      url: link?.href,
    };
  })()`);
  assert.equal(result.status, "success");
  assert.equal(result.url, RUN_URL);
  assert.match(result.label || "", /마지막 수동 점검 결과/);
  await clickAriaLabel(cdp, "마지막 수동 점검 결과 기록 지우기");
  await waitForCondition(
    cdp,
    `!document.querySelector('[data-testid="smoke-last-manual-run"]') &&
      localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null`,
    timeoutMs,
    "마지막 수동 점검 결과가 삭제되지 않았습니다",
  );
  const deletedReload = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  await deletedReload;
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-manual-suppress-notice"]') &&
      !document.querySelector('[data-testid="smoke-last-manual-run"]') &&
      localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null`,
    timeoutMs,
    "삭제한 수동 점검 결과가 새로고침 후 다시 나타났습니다",
  );
  return true;
}

import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function readManagerDeploymentFixtureSource(cdp) {
  return evaluate(cdp, `(async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await fetch('/api/v1/docker/deployment', {
          credentials: 'include',
          cache: 'no-store',
        });
        return { body: await result.json(), ok: result.ok };
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  })()`);
}

export async function setManagerDeploymentArchiveSample({
  cdp,
  expectedCount,
  timeoutMs,
  value,
}) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-history-archive-sample]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 보관 표본 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const entries = Array.from(document.querySelectorAll(
        '[data-history-source="archive"] li[data-deployment-status]',
      ));
      const expectedSample = ${JSON.stringify(value === "all" ? null : value)};
      return entries.length === ${expectedCount} &&
        (!expectedSample || entries.every((entry) => entry.querySelector(
          '[data-deployment-archive-sample]',
        )?.getAttribute('data-deployment-archive-sample') === expectedSample)) &&
        ${value === "all"
          ? "!params.has('deployment_archive_sample') && !document.querySelector('[data-history-condition=\"archive_sample\"]')"
          : `params.get('deployment_archive_sample') === ${JSON.stringify(value)} && Boolean(document.querySelector('[data-history-condition="archive_sample"]'))`};
    })()`,
    timeoutMs,
    `Manager 보관 ${value} 표본 필터가 적용되지 않았습니다`,
  );
}

export async function checkManagerDeploymentArchiveSamples({ cdp, timeoutMs }) {
  await setManagerDeploymentArchiveSample({ cdp, expectedCount: 1, timeoutMs, value: "daily" });
  await setManagerDeploymentArchiveSample({ cdp, expectedCount: 2, timeoutMs, value: "all" });
}

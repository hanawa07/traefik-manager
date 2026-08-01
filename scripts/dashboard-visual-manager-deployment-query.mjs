import assert from "node:assert/strict";

import { setManagerDeploymentArchiveSample } from "./dashboard-visual-manager-deployment-archive.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkHistorySearchAndFilters({ cdp, timeoutMs }) {
  await setHistorySearch({ cdp, expectedText: "v1.38.69", timeoutMs, value: "v1.38.69" });
  await setHistorySearch({ cdp, expectedText: "v1.38.69", timeoutMs, value: "bbbbbbbbbbbb" });
  await setManagerDeploymentArchiveSample({ cdp, expectedCount: 0, timeoutMs, value: "detailed" });
  await setHistorySearch({ cdp, expectedText: "v1.38.70", timeoutMs, value: "probe failure" });
  const statusClicked = await evaluate(cdp, `(() => {
    const status = document.querySelector('[data-history-filter="rolled_back"]');
    status?.click();
    return Boolean(status);
  })()`);
  assert.equal(statusClicked, true, "Manager 배포 상태 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('deployment_status') === 'rolled_back'`,
    timeoutMs,
    "Manager 배포 상태 URL 조건이 적용되지 않았습니다",
  );
  const stageClicked = await evaluate(cdp, `(() => {
    const stage = document.querySelector('[data-failure-stage-filter="public_probe"]');
    stage?.click();
    return Boolean(stage);
  })()`);
  assert.equal(stageClicked, true, "Manager 배포 실패 단계 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const entries = Array.from(document.querySelectorAll(
        '[data-history-source="archive"] li[data-deployment-status]',
      ));
      return entries.length === 1 && entries.every(
        (entry) => entry.getAttribute('data-deployment-status') === 'rolled_back' &&
          entry.getAttribute('data-deployment-failure-stage') === 'public_probe',
      ) && params.get('deployment_source') === 'archive' &&
        params.get('deployment_period') === '30' &&
        params.get('deployment_status') === 'rolled_back' &&
        params.get('deployment_stage') === 'public_probe' &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 검색·상태·실패 단계 URL 조건이 적용되지 않았습니다",
  );
  await checkActiveConditionRemoval({ cdp, timeoutMs });
}

async function checkActiveConditionRemoval({ cdp, timeoutMs }) {
  const conditions = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-active-conditions] [data-history-condition]',
  )).map((condition) => condition.getAttribute('data-history-condition'))`);
  assert.deepEqual(
    conditions,
    ["source", "archive_sample", "period", "status", "stage", "search"],
    "Manager 배포 이력 적용 조건 칩 구성이 다릅니다",
  );

  const searchRemoved = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-history-condition="search"]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(searchRemoved, true, "Manager 배포 검색 조건 제거 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const conditions = Array.from(document.querySelectorAll('[data-history-condition]'))
        .map((condition) => condition.getAttribute('data-history-condition'));
      return !params.has('deployment_q') &&
        params.get('deployment_source') === 'archive' &&
        params.get('deployment_period') === '30' &&
        params.get('deployment_status') === 'rolled_back' &&
        params.get('deployment_stage') === 'public_probe' &&
        conditions.join(',') === 'source,archive_sample,period,status,stage';
    })()`,
    timeoutMs,
    "Manager 배포 검색 조건만 개별 제거되지 않았습니다",
  );
  await setHistorySearch({
    cdp,
    expectedText: "v1.38.70",
    timeoutMs,
    value: "probe failure",
  });
}

async function setHistorySearch({ cdp, expectedText, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-history-search]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Manager 배포 이력 검색어를 입력하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const section = document.querySelector('[data-history-source="archive"]');
      return section?.querySelectorAll('li[data-deployment-status]').length === 1 &&
        section.textContent?.includes(${JSON.stringify(expectedText)}) &&
        document.querySelector('[data-history-search]')?.value === ${JSON.stringify(value)} &&
        Array.from(section.querySelectorAll('[data-history-search-highlight]')).some(
          (highlight) => highlight.textContent?.toLowerCase() === ${JSON.stringify(value.toLowerCase())},
        );
    })()`,
    timeoutMs,
    `Manager 배포 이력 ${value} 검색이 적용되지 않았습니다`,
  );
}

export async function waitForHistoryQueryRestore({ cdp, timeoutMs }) {
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const entry = document.querySelector(
        '[data-history-source="archive"] li[data-deployment-status]',
      );
      return document.querySelector('[data-history-search]')?.value === 'probe failure' &&
        document.querySelector('[data-history-archive-sample]')?.value === 'detailed' &&
        document.querySelector('[data-history-period]')?.value === '30' &&
        document.querySelector('[data-history-filter="rolled_back"]')?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('[data-failure-stage-filter="public_probe"]')?.getAttribute('aria-pressed') === 'true' &&
        entry?.getAttribute('data-deployment-status') === 'rolled_back' &&
        entry.getAttribute('data-deployment-failure-stage') === 'public_probe' &&
        document.querySelectorAll('[data-history-condition]').length === 6 &&
        document.querySelector('[data-history-search-highlight]')?.textContent === 'probe failure' &&
        params.get('deployment_source') === 'archive' &&
        params.get('deployment_archive_sample') === 'detailed' &&
        params.get('deployment_period') === '30' &&
        !params.has('deployment_from') && !params.has('deployment_to') &&
        params.get('deployment_q') === 'probe failure';
    })()`,
    timeoutMs,
    "Manager 배포 이력 URL 조건이 새로고침 후 복원되지 않았습니다",
  );
}

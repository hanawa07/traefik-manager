import assert from "node:assert/strict";

import { checkManagerDeploymentPeriodComparison } from "./dashboard-visual-manager-deployment-performance.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentPeriodActions({ cdp, timeoutMs }) {
  await selectPeriod({ cdp, expectedCount: 1, timeoutMs, value: "7" });
  await checkManagerDeploymentPeriodComparison(cdp);
  await selectPeriod({ cdp, expectedCount: 2, timeoutMs, value: "30" });
  await checkCustomDateRange({ cdp, timeoutMs });
  await selectPeriod({ cdp, expectedCount: 2, timeoutMs, value: "30" });
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
        params.get('deployment_period') === ${JSON.stringify(value)} &&
        !params.has('deployment_from') && !params.has('deployment_to');
    })()`,
    timeoutMs,
    `Manager 최근 ${value}일 배포 기간 필터가 적용되지 않았습니다`,
  );
}

async function checkCustomDateRange({ cdp, timeoutMs }) {
  const dateFrom = formatDateInput(5);
  const dateTo = formatDateInput(0);
  await setDateInput({ cdp, kind: "from", timeoutMs, value: dateFrom });
  await setDateInput({ cdp, kind: "to", timeoutMs, value: dateTo });
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const conditions = Array.from(document.querySelectorAll('[data-history-condition]'))
        .map((condition) => condition.getAttribute('data-history-condition'));
      return document.querySelector('[data-history-period]')?.value === 'all' &&
        document.querySelectorAll(
          '[data-history-source="archive"] li[data-deployment-status]',
        ).length === 1 &&
        params.get('deployment_from') === ${JSON.stringify(dateFrom)} &&
        params.get('deployment_to') === ${JSON.stringify(dateTo)} &&
        !params.has('deployment_period') &&
        conditions.join(',') === 'source,date_from,date_to';
    })()`,
    timeoutMs,
    "Manager 사용자 지정 배포 기간이 적용되지 않았습니다",
  );
}

async function setDateInput({ cdp, kind, timeoutMs, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(`[data-history-date-${kind}]`)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Manager 사용자 지정 ${kind} 날짜를 입력하지 못했습니다`);
  const queryKey = kind === "from" ? "deployment_from" : "deployment_to";
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get(${JSON.stringify(queryKey)}) === ${JSON.stringify(value)}`,
    timeoutMs,
    `Manager 사용자 지정 ${kind} 날짜가 URL에 반영되지 않았습니다`,
  );
}

function formatDateInput(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

import assert from "node:assert/strict";

import {
  assertRequest,
  buildMaintenanceHistory,
  fulfillJson,
  SERVICE_ID,
  SERVICE_NAME,
  waitForFetch,
} from "./dashboard-visual-maintenance-fixture.mjs";
import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkMaintenanceHistory({ cdp, services, timeoutMs }) {
  const historyRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 변경 이력");
  await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 종료 시각 변경 이력`);
  const history = await historyRequest;
  assertRequest(history, "GET", "/api/v1/audit");
  const historyUrl = new URL(history.request.url);
  assert.equal(historyUrl.searchParams.get("resource_type"), "service");
  assert.equal(historyUrl.searchParams.get("action"), "update");
  assert.equal(historyUrl.searchParams.get("event"), "service_update");
  assert.equal(historyUrl.searchParams.get("search"), SERVICE_ID);
  await fulfillJson(cdp, history, buildMaintenanceHistory());
  await waitForCondition(
    cdp,
    `(() => {
      const panel = document.querySelector('[data-testid="maintenance-schedule-history"]');
      const latest = panel?.querySelector('[data-maintenance-history-before="unset"]');
      const auditLink = document.querySelector('[data-testid="maintenance-history-audit-link"]');
      const auditUrl = auditLink ? new URL(auditLink.href) : null;
      return panel?.getAttribute('data-maintenance-history-count') === '2' &&
        latest?.getAttribute('data-maintenance-history-after') === '2035-02-03T05:30:00.000Z' &&
        panel.textContent?.includes('smoke-admin') && auditUrl?.pathname === '/dashboard/audit' &&
        auditUrl.searchParams.get('q') === '${SERVICE_ID}' &&
        new URLSearchParams(location.search).get('maintenance_history_service') === '${SERVICE_ID}';
    })()`,
    timeoutMs,
    "점검 종료 시각 변경 이력이 펼쳐지지 않았습니다",
  );

  await changeSelect(cdp, "점검 변경 이력 변경자", "ops-admin");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="maintenance-schedule-history"]')?.getAttribute('data-maintenance-history-count') === '1' &&
      document.querySelector('[data-testid="maintenance-schedule-history"]')?.getAttribute('data-maintenance-history-actor') === 'ops-admin' &&
      document.querySelector('[data-testid="maintenance-schedule-history"]')?.textContent?.includes('ops-admin') &&
      new URLSearchParams(location.search).get('maintenance_history_actor') === 'ops-admin'`,
    timeoutMs,
    "점검 종료 시각 변경자 필터가 적용되지 않았습니다",
  );

  const periodHistoryRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 기간 필터");
  await changeSelect(cdp, "점검 변경 이력 기간", "30");
  const periodHistory = await periodHistoryRequest;
  assert.equal(new URL(periodHistory.request.url).searchParams.get("period_days"), "30");
  await fulfillJson(cdp, periodHistory, buildMaintenanceHistory());
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="maintenance-schedule-history"]')?.getAttribute('data-maintenance-history-count') === '1' &&
      document.querySelector('[data-testid="maintenance-schedule-history"]')?.getAttribute('data-maintenance-history-period') === '30' &&
      new URLSearchParams(location.search).get('maintenance_history_period') === '30'`,
    timeoutMs,
    "점검 종료 시각 기간 필터가 적용되지 않았습니다",
  );

  const startDateRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 시작일 필터");
  await changeDateInput(cdp, "점검 변경 이력 시작일", "2035-02-01");
  const startDateHistory = await startDateRequest;
  const startDateUrl = new URL(startDateHistory.request.url);
  assert.equal(startDateUrl.searchParams.get("start_date"), "2035-02-01");
  assert.equal(startDateUrl.searchParams.has("period_days"), false);
  await fulfillJson(cdp, startDateHistory, buildMaintenanceHistory());

  const endDateRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 종료일 필터");
  await changeDateInput(cdp, "점검 변경 이력 종료일", "2035-02-03");
  const endDateHistory = await endDateRequest;
  const endDateUrl = new URL(endDateHistory.request.url);
  assert.equal(endDateUrl.searchParams.get("start_date"), "2035-02-01");
  assert.equal(endDateUrl.searchParams.get("end_date"), "2035-02-03");
  await fulfillJson(cdp, endDateHistory, buildMaintenanceHistory());
  await waitForCondition(
    cdp,
    `(() => {
      const panel = document.querySelector('[data-testid="maintenance-schedule-history"]');
      return panel?.getAttribute('data-maintenance-history-period') === 'custom' &&
        panel.getAttribute('data-maintenance-history-start-date') === '2035-02-01' &&
        panel.getAttribute('data-maintenance-history-end-date') === '2035-02-03' &&
        new URLSearchParams(location.search).get('maintenance_history_period') === 'custom' &&
        new URLSearchParams(location.search).get('maintenance_history_start') === '2035-02-01' &&
        new URLSearchParams(location.search).get('maintenance_history_end') === '2035-02-03';
    })()`,
    timeoutMs,
    "점검 종료 시각 직접 날짜 범위가 적용되지 않았습니다",
  );

  const reloadServicesRequest = waitForFetch(cdp, timeoutMs, "점검 이력 URL 새로고침 서비스 목록");
  const reloaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  const reloadServices = await reloadServicesRequest;
  assertRequest(reloadServices, "GET", "/api/v1/services");
  const restoredHistoryRequest = waitForFetch(cdp, timeoutMs, "점검 이력 URL 자동 복원");
  await fulfillJson(cdp, reloadServices, services);
  const restoredHistory = await restoredHistoryRequest;
  const restoredUrl = new URL(restoredHistory.request.url);
  assert.equal(restoredUrl.searchParams.get("start_date"), "2035-02-01");
  assert.equal(restoredUrl.searchParams.get("end_date"), "2035-02-03");
  await fulfillJson(cdp, restoredHistory, buildMaintenanceHistory());
  await reloaded;
  await waitForCondition(
    cdp,
    `(() => {
      const panel = document.querySelector('[data-testid="maintenance-schedule-history"]');
      return panel?.getAttribute('data-maintenance-history-count') === '1' &&
        panel.getAttribute('data-maintenance-history-actor') === 'ops-admin' &&
        panel.getAttribute('data-maintenance-history-period') === 'custom' &&
        panel.getAttribute('data-maintenance-history-start-date') === '2035-02-01' &&
        panel.getAttribute('data-maintenance-history-end-date') === '2035-02-03';
    })()`,
    timeoutMs,
    "점검 이력 URL 필터가 새로고침 후 복원되지 않았습니다",
  );
  await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 종료 시각 변경 이력`);
  await waitForCondition(
    cdp,
    `!document.querySelector('[data-testid="maintenance-schedule-history"]') &&
      document.querySelector('button[aria-label="${SERVICE_NAME} 점검 종료 시각 변경 이력"]')?.getAttribute('aria-expanded') === 'false' &&
      !new URLSearchParams(location.search).has('maintenance_history_service')`,
    timeoutMs,
    "점검 종료 시각 변경 이력이 닫히지 않았습니다",
  );
  const expandedAfterReload = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-maintenance-schedule-toggle]');
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(expandedAfterReload, true, "새로고침 후 점검 일정 전체 보기 버튼이 없습니다");
  await waitForCondition(
    cdp,
    "document.querySelectorAll('[data-maintenance-service-id]').length === 5",
    timeoutMs,
    "새로고침 후 점검 일정 전체 목록이 펼쳐지지 않았습니다",
  );
}

async function changeSelect(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector(${JSON.stringify(`select[aria-label="${label}"]`)});
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 선택 항목을 찾지 못했습니다`);
}

async function changeDateInput(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(`input[aria-label="${label}"]`)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(changed, true, `${label}: 날짜 입력을 변경하지 못했습니다`);
}

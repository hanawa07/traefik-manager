import assert from "node:assert/strict";

import { checkAuditCsvExports } from "./dashboard-visual-audit-export.mjs";
import {
  assertAuditPagination,
  assertManagerCrossCount,
  changeAuditTextInput,
  waitForAuditQueryParam,
  waitForAuditQueryParamAbsent,
} from "./dashboard-visual-audit-filter-controls.mjs";
import { assertAuditFilterLayout } from "./dashboard-visual-audit-filter-layout.mjs";
import { checkManagerHttpAuditAutoExpand } from "./dashboard-visual-audit-manager-http.mjs";
import { checkTraefikAuditAutoExpand } from "./dashboard-visual-audit-traefik-update.mjs";
import {
  clickAriaLabel,
  evaluate,
  reloadPage,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

export async function checkAuditFilterPersistence({ cdp, profile, timeoutMs }) {
  await assertAuditFilterLayout(cdp, profile.mobile);
  await assertAuditPagination(cdp, timeoutMs);
  const managerFound = await evaluate(cdp, `(() => {
    const manager = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Manager 전체')
    );
    manager?.click();
    return Boolean(manager);
  })()`);
  assert.equal(managerFound, true, "감사 로그 Manager 필터를 찾지 못했습니다");
  await waitForAuditQueryParam(cdp, "filter", "manager_health", timeoutMs);
  await waitForAuditQueryParamAbsent(cdp, "page", timeoutMs);
  await changeAuditTextInput(cdp, "감사 로그 검색", "lizstudio");
  await waitForAuditQueryParam(cdp, "q", "lizstudio", timeoutMs);

  const selectChanges = [
    ["감사 기간", "7", "period"],
    ["Manager 소스", "api", "manager_source"],
    ["Manager 상태", "unhealthy", "manager_status"],
    ["전송 상태", "failure", "delivery_status"],
    ["알림 채널", "telegram", "delivery_provider"],
    ["Manager 집계 기간", "1440", "manager_window"],
  ];
  for (const [label, value, queryKey] of selectChanges) {
    await waitForCondition(
      cdp,
      `Boolean(document.querySelector(${JSON.stringify(`select[aria-label="${label}"]`)}))`,
      timeoutMs,
      `감사 로그 ${label} 필터가 다시 표시되지 않았습니다`,
    );
    const changed = await evaluate(cdp, `(() => {
      const select = document.querySelector(${JSON.stringify(`select[aria-label="${label}"]`)});
      if (!select) return false;
      select.value = ${JSON.stringify(value)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assert.equal(changed, true, `감사 로그 ${label} 필터를 찾지 못했습니다`);
    await waitForAuditQueryParam(cdp, queryKey, value, timeoutMs);
  }
  await assertManagerCrossCount(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `document.body.textContent?.includes('검색: lizstudio') && document.body.textContent?.includes('상태: 이상')`,
    timeoutMs,
    "감사 로그 적용 조건 요약이 표시되지 않았습니다",
  );
  await reloadPage(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `(() => {
      const manager = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Manager 전체')
      );
      return manager?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('input[aria-label="감사 로그 검색"]')?.value === 'lizstudio' &&
        document.querySelector('select[aria-label="Manager 소스"]')?.value === 'api' &&
        document.querySelector('select[aria-label="Manager 상태"]')?.value === 'unhealthy' &&
        document.querySelector('select[aria-label="전송 상태"]')?.value === 'failure' &&
        document.querySelector('select[aria-label="알림 채널"]')?.value === 'telegram' &&
        document.querySelector('select[aria-label="Manager 집계 기간"]')?.value === '1440' &&
        document.querySelector('select[aria-label="감사 기간"]')?.value === '7' &&
        document.querySelector('select[aria-label="감사 로그 페이지 크기"]')?.value === '100';
    })()`,
    timeoutMs,
    "새로고침 후 감사 로그 필터가 복원되지 않았습니다",
  );
  await clickAriaLabel(cdp, "검색: lizstudio 조건 제거");
  await waitForAuditQueryParamAbsent(cdp, "q", timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('input[aria-label="감사 로그 검색"]')?.value === '' &&
      !document.querySelector('button[aria-label="검색: lizstudio 조건 제거"]') &&
      document.querySelector('select[aria-label="Manager 상태"]')?.value === 'unhealthy' &&
      document.querySelector('select[aria-label="알림 채널"]')?.value === 'telegram'`,
    timeoutMs,
    "감사 로그 검색 조건만 개별 제거되지 않았습니다",
  );
  const today = await evaluate(cdp, `new Date().toISOString().slice(0, 10)`);
  await changeAuditTextInput(cdp, "감사 시작일", today);
  await waitForAuditQueryParam(cdp, "start_date", today, timeoutMs);
  await waitForAuditQueryParamAbsent(cdp, "period", timeoutMs);
  await changeAuditTextInput(cdp, "감사 종료일", today);
  await waitForAuditQueryParam(cdp, "end_date", today, timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('input[aria-label="감사 시작일"]')?.value === '${today}' &&
      document.querySelector('input[aria-label="감사 종료일"]')?.value === '${today}' &&
      document.querySelector('select[aria-label="감사 기간"]')?.value === 'all' &&
      document.body.textContent?.includes('기간: ${today} ~ ${today}')`,
    timeoutMs,
    "감사 로그 사용자 지정 날짜 범위가 적용되지 않았습니다",
  );
  await reloadPage(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('input[aria-label="감사 시작일"]')?.value === '${today}' &&
      document.querySelector('input[aria-label="감사 종료일"]')?.value === '${today}'`,
    timeoutMs,
    "새로고침 후 감사 로그 날짜 범위가 복원되지 않았습니다",
  );
  await checkAuditCsvExports({ cdp, timeoutMs, today });
  await clickAriaLabel(cdp, "감사 필터 전체 초기화");
  await waitForCondition(
    cdp,
    `(() => {
      const all = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '전체'
      );
      return location.search === '' &&
        all?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('input[aria-label="감사 로그 검색"]')?.value === '' &&
        document.querySelector('select[aria-label="Manager 소스"]')?.value === 'all' &&
        document.querySelector('select[aria-label="Manager 상태"]')?.value === 'all' &&
        document.querySelector('select[aria-label="전송 상태"]')?.value === 'all' &&
        document.querySelector('select[aria-label="알림 채널"]')?.value === 'all' &&
        document.querySelector('select[aria-label="Manager 집계 기간"]')?.value === '10080' &&
        document.querySelector('select[aria-label="감사 기간"]')?.value === 'all' &&
        document.querySelector('input[aria-label="감사 시작일"]')?.value === '' &&
        document.querySelector('input[aria-label="감사 종료일"]')?.value === '' &&
        document.querySelector('select[aria-label="감사 로그 페이지 크기"]')?.value === '50' &&
        document.body.textContent?.includes('전체 로그');
    })()`,
    timeoutMs,
    "감사 로그 전체 초기화가 기본값을 복원하지 못했습니다",
  );
  await checkManagerHttpAuditAutoExpand(cdp, timeoutMs);
  await checkTraefikAuditAutoExpand(cdp, timeoutMs);
  return true;
}

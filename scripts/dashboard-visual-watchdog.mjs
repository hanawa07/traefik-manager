import assert from "node:assert/strict";

import {
  clickAriaLabel,
  evaluate,
  reloadPage,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

export async function checkWatchdogFilterPersistence({ cdp, timeoutMs }) {
  await evaluate(cdp, `(() => {
    const params = new URLSearchParams(location.search);
    params.set('watchdog_event', 'failure');
    params.set('watchdog_result', 'pending');
    history.replaceState(null, '', location.pathname + '?' + params);
    return true;
  })()`);
  const filtersRestored = `document.querySelector('select[aria-label="watchdog 알림 종류 필터"]')?.value === 'failure' &&
    document.querySelector('select[aria-label="watchdog 실행 결과 필터"]')?.value === 'pending'`;
  await waitForCondition(cdp, filtersRestored, timeoutMs, "watchdog 필터가 URL 상태를 반영하지 못했습니다");
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('button[aria-label="watchdog 장애 알림 조건 제거"]')) &&
      Boolean(document.querySelector('button[aria-label="watchdog 진행·확인 중 조건 제거"]')) &&
      document.querySelector('button[aria-label="watchdog 필터 전체 초기화"]')?.disabled === false`,
    timeoutMs,
    "watchdog 적용 조건 배지가 표시되지 않았습니다",
  );
  await clickAriaLabel(cdp, "watchdog 장애 알림 조건 제거");
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has('watchdog_event') &&
      new URLSearchParams(location.search).get('watchdog_result') === 'pending'`,
    timeoutMs,
    "watchdog 조건 하나만 제거되지 않았습니다",
  );
  await changeSelect(cdp, "watchdog 알림 종류 필터", "failure");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('watchdog_event') === 'failure'`,
    timeoutMs,
    "watchdog 알림 종류가 URL에 다시 저장되지 않았습니다",
  );
  await reloadPage(cdp, timeoutMs);
  await waitForCondition(cdp, filtersRestored, timeoutMs, "새로고침 후 watchdog 필터가 복원되지 않았습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('button[aria-label="watchdog 실행 이력 새로고침"]')?.disabled === false`,
    timeoutMs,
    "watchdog 실행 이력 새로고침 버튼이 활성화되지 않았습니다",
  );
  await clickAriaLabel(cdp, "watchdog 실행 이력 새로고침");
  await waitForCondition(
    cdp,
    `document.body.textContent?.includes('수동 갱신:') && !document.body.textContent?.includes('수동 갱신: 아직 없음')`,
    timeoutMs,
    "watchdog 마지막 수동 갱신 시각이 표시되지 않았습니다",
  );
  await clickAriaLabel(cdp, "watchdog 필터 전체 초기화");
  await waitForCondition(
    cdp,
    `document.querySelector('select[aria-label="watchdog 알림 종류 필터"]')?.value === 'all' &&
      document.querySelector('select[aria-label="watchdog 실행 결과 필터"]')?.value === 'all' &&
      document.body.textContent?.includes('전체 실행') &&
      !new URLSearchParams(location.search).has('watchdog_event') &&
      !new URLSearchParams(location.search).has('watchdog_result')`,
    timeoutMs,
    "watchdog 필터 전체 초기화가 반영되지 않았습니다",
  );
  return true;
}

async function changeSelect(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector(${JSON.stringify(`select[aria-label="${label}"]`)});
    if (!select) return false;
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 선택 필드를 찾지 못했습니다`);
}

import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeFailureMetadataActiveFilters({ cdp, timeoutMs }) {
  await waitForCondition(
    cdp,
    `(() => {
      const filters = document.querySelector('[data-testid="smoke-failure-metadata-active-filters"]');
      return filters?.querySelector('[data-testid="smoke-failure-metadata-active-filter-count"]')?.textContent?.includes('적용 조건 4개') &&
        filters.querySelector('[data-testid="smoke-failure-metadata-active-filter-type"]')?.textContent?.includes('유형: 로그인') &&
        filters.querySelector('[data-testid="smoke-failure-metadata-active-filter-period"]')?.textContent?.includes('기간:') &&
        filters.querySelector('[data-testid="smoke-failure-metadata-active-filter-query"]')?.textContent?.includes('검색: 관리자') &&
        filters.querySelector('[data-testid="smoke-failure-metadata-active-filter-sort"]')?.textContent?.includes('정렬: 실행 번호 낮은순');
    })()`,
    timeoutMs,
    "실패 정보 활성 필터가 조건별로 표시되지 않았습니다",
  );

  const cleared = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-active-filter-query"]');
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  })()`);
  assert.equal(cleared, true, "실패 정보 검색 필터를 개별 해제하지 못했습니다");
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has('smoke_metadata_q') &&
      document.querySelector('[data-testid="smoke-failure-metadata-search"]')?.value === '' &&
      !document.querySelector('[data-testid="smoke-failure-metadata-active-filter-query"]') &&
      document.querySelector('[data-testid="smoke-failure-metadata-active-filter-count"]')?.textContent?.includes('적용 조건 3개')`,
    timeoutMs,
    "실패 정보 검색 필터 해제가 화면과 URL에 반영되지 않았습니다",
  );

  const restored = await evaluate(cdp, `(() => {
    const search = document.querySelector('[data-testid="smoke-failure-metadata-search"]');
    if (!(search instanceof HTMLInputElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(search, '관리자');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(restored, true, "실패 정보 검색 필터를 복원하지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('smoke_metadata_q') === '관리자' &&
      document.querySelector('[data-testid="smoke-failure-metadata-active-filter-query"]')?.textContent?.includes('검색: 관리자') &&
      document.querySelector('[data-testid="smoke-failure-metadata-active-filter-count"]')?.textContent?.includes('적용 조건 4개')`,
    timeoutMs,
    "실패 정보 검색 필터 복원이 화면과 URL에 반영되지 않았습니다",
  );
}

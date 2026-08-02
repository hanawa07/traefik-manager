import assert from "node:assert/strict";

import {
  fulfillJsonRequest,
  PAGE_TWO_RUN_URL,
} from "./dashboard-visual-smoke-history-fixture.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeHistoryFilters({
  cdp,
  fixtures,
  timeoutMs,
}) {
  const {
    failureFixture,
    fixture,
    pageTwoFixture,
    searchFixture,
    sevenDayFixture,
    successFixture,
  } = fixtures;
  const successRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const statusChanged = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid="smoke-recent-run-status-filter"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!(select instanceof HTMLSelectElement) || !setter) return false;
    setter.call(select, 'success');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(statusChanged, true, "최근 운영 점검 상태 필터를 변경하지 못했습니다");
  const successPaused = await successRequest;
  assert.match(successPaused.request.url, /history_status=success/);
  await fulfillJsonRequest(cdp, successPaused, successFixture);
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
      const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
      return items?.length === 1 && items[0].textContent?.includes('#985') &&
        count?.textContent?.includes('1/1건');
    })()`,
    timeoutMs,
    "최근 운영 점검 성공 상태 필터가 적용되지 않았습니다",
  );
  const failureRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const failureChanged = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid="smoke-recent-run-status-filter"]');
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!(select instanceof HTMLSelectElement) || !selectSetter) return false;
    selectSetter.call(select, 'failure');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(failureChanged, true, "최근 운영 점검 실패 상태 필터를 변경하지 못했습니다");
  const failurePaused = await failureRequest;
  assert.match(failurePaused.request.url, /history_status=failure/);
  await fulfillJsonRequest(cdp, failurePaused, failureFixture);

  const searchChanged = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-testid="smoke-recent-run-search"]');
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!(input instanceof HTMLInputElement) || !inputSetter) return false;
    inputSetter.call(input, '986');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(searchChanged, true, "최근 운영 점검 검색어를 입력하지 못했습니다");
  const searchRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const searchSubmitted = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-testid="smoke-recent-run-search"]');
    const form = input?.closest('form');
    if (!(form instanceof HTMLFormElement)) return false;
    form.requestSubmit();
    return true;
  })()`);
  assert.equal(searchSubmitted, true, "최근 운영 점검 검색을 제출하지 못했습니다");
  const searchPaused = await searchRequest;
  assert.match(searchPaused.request.url, /history_search=986/);
  assert.match(searchPaused.request.url, /history_status=failure/);
  await fulfillJsonRequest(cdp, searchPaused, searchFixture);
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
      const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
      return items?.length === 1 && items[0].textContent?.includes('#986') &&
        count?.textContent?.includes('1/1건');
    })()`,
    timeoutMs,
    "최근 운영 점검 상태·검색 조합이 적용되지 않았습니다",
  );
  const filterUrl = await evaluate(cdp, "location.search");
  assert.match(filterUrl, /smoke_status=failure/);
  assert.match(filterUrl, /smoke_search=986/);

  const reloadRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const restoredFilterRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const reloaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  await fulfillJsonRequest(cdp, await reloadRequest, fixture);
  await reloaded;
  const restoredFilterPaused = await restoredFilterRequest;
  assert.match(restoredFilterPaused.request.url, /history_search=986/);
  assert.match(restoredFilterPaused.request.url, /history_status=failure/);
  await fulfillJsonRequest(cdp, restoredFilterPaused, searchFixture);
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      if (history instanceof HTMLDetailsElement) history.open = true;
      const status = history?.querySelector('[data-testid="smoke-recent-run-status-filter"]');
      const search = history?.querySelector('[data-testid="smoke-recent-run-search"]');
      const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
      return status?.value === 'failure' && search?.value === '986' &&
        items?.length === 1 && items[0].textContent?.includes('#986');
    })()`,
    timeoutMs,
    "최근 운영 점검 필터가 새로고침 후 복원되지 않았습니다",
  );

  const filtersReset = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(filtersReset, true, "최근 운영 점검 필터 초기화 버튼을 누르지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      const status = history?.querySelector('[data-testid="smoke-recent-run-status-filter"]');
      const search = history?.querySelector('[data-testid="smoke-recent-run-search"]');
      const reset = history?.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
      const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
      return status?.value === 'all' && search?.value === '' &&
        reset?.disabled === true && count?.textContent?.includes('4/8건') &&
        !location.search.includes('smoke_status') && !location.search.includes('smoke_search');
    })()`,
    timeoutMs,
    "최근 운영 점검 필터가 기본값으로 돌아오지 않았습니다",
  );

  const daysRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const daysChanged = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid="smoke-recent-run-days-filter"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!(select instanceof HTMLSelectElement) || !setter) return false;
    setter.call(select, '7');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(daysChanged, true, "최근 운영 점검 조회 기간을 변경하지 못했습니다");
  const daysPaused = await daysRequest;
  assert.match(daysPaused.request.url, /history_days=7/);
  assert.match(daysPaused.request.url, /history_page=1/);
  await fulfillJsonRequest(cdp, daysPaused, sevenDayFixture);
  await waitForCondition(
    cdp,
    `(() => {
      const page = document.querySelector('[data-testid="smoke-recent-run-page"]');
      const days = document.querySelector('[data-testid="smoke-recent-run-days-filter"]');
      return page?.textContent?.includes('1/2 페이지') && days?.value === '7';
    })()`,
    timeoutMs,
    "최근 운영 점검 7일 이력이 표시되지 않았습니다",
  );

  const pageRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const nextClicked = await evaluate(cdp, `(() => {
    const buttons = document.querySelectorAll('[data-testid="smoke-recent-run-pagination"] button');
    const next = buttons[buttons.length - 1];
    if (!(next instanceof HTMLButtonElement) || next.disabled) return false;
    next.click();
    return true;
  })()`);
  assert.equal(nextClicked, true, "최근 운영 점검 다음 페이지를 누르지 못했습니다");
  const pagePaused = await pageRequest;
  assert.match(pagePaused.request.url, /history_page=2/);
  await fulfillJsonRequest(cdp, pagePaused, pageTwoFixture);
  await waitForCondition(
    cdp,
    `(() => {
      const page = document.querySelector('[data-testid="smoke-recent-run-page"]');
      const run = document.querySelector('a[href="${PAGE_TWO_RUN_URL}"]');
      return page?.textContent?.includes('2/2 페이지') && run?.textContent?.includes('#984') &&
        location.search.includes('smoke_days=7') && location.search.includes('smoke_page=2');
    })()`,
    timeoutMs,
    "최근 운영 점검 페이지 이동이 적용되지 않았습니다",
  );

  const pageFiltersReset = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(pageFiltersReset, true, "최근 운영 점검 기간·페이지 필터를 초기화하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      const days = history?.querySelector('[data-testid="smoke-recent-run-days-filter"]');
      const page = history?.querySelector('[data-testid="smoke-recent-run-page"]');
      const reset = history?.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
      return days?.value === '30' && page?.textContent?.includes('1/2 페이지') &&
        reset?.disabled === true && !location.search.includes('smoke_days') &&
        !location.search.includes('smoke_page');
    })()`,
    timeoutMs,
    "최근 운영 점검 기간·페이지가 기본값으로 돌아오지 않았습니다",
  );
}

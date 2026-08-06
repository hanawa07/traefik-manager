import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";
import { checkSmokeFailureMetadataSavedFilters } from "./dashboard-visual-smoke-failure-metadata-saved-filters.mjs";
import {
  checkSmokeFailureMetadataCleanupPreview,
  checkSmokeFailureMetadataCleanupSuccess,
} from "./dashboard-visual-smoke-failure-metadata-cleanup-preview.mjs";
import { checkSmokeFailureMetadataExport } from "./dashboard-visual-smoke-failure-metadata-export.mjs";

export function applySmokeFailureMetadataFixture(fixture) {
  fixture.monitoring_failure_metadata_count = 2;
  fixture.monitoring_failure_metadata_entries = [
    {
      run_id: 987,
      captured_at: new Date(Date.now() - 60_000).toISOString(),
      check_name: "관리자 로그인 검사 실패",
      failure_type: "login",
      screen_path: "/login",
      page_title: "로그인",
    },
    {
      run_id: 986,
      captured_at: new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString(),
      check_name: "외부 API 검사 실패",
      failure_type: "external_api",
      screen_path: null,
      page_title: null,
    },
  ];
}

export async function checkSmokeFailureMetadataManagement({ cdp, fixture, timeoutMs }) {
  await waitForCondition(
    cdp,
    `(() => {
      const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
      if (management instanceof HTMLDetailsElement) management.open = true;
      return management?.querySelector('[data-testid="smoke-failure-metadata-export"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-filtered-csv"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-selected-export"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-selected-csv"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-clear-selection"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-select-visible"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-clear-visible"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-select-all"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-type-filter"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-period-filter"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-sort"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-search"]') instanceof HTMLInputElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-period-filter"] option[value="custom"]') instanceof HTMLOptionElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-date-preset-today"]') instanceof HTMLButtonElement;
    })()`,
    timeoutMs,
    "실패 정보 관리·내보내기 컨트롤을 찾지 못했습니다",
  );
  const sorted = await evaluate(cdp, `(() => {
    const sort = document.querySelector('[data-testid="smoke-failure-metadata-sort"]');
    if (!(sort instanceof HTMLSelectElement)) return false;
    sort.value = 'run_asc';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(sorted, true, "실패 정보 정렬을 변경하지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('smoke_metadata_sort') === 'run_asc' &&
      document.querySelector('[data-testid="smoke-failure-metadata-run-link"]')?.getAttribute('href')?.endsWith('/actions/runs/986')`,
    timeoutMs,
    "실패 정보 실행 번호 낮은순 정렬이 반영되지 않았습니다",
  );
  const changed = await evaluate(cdp, `(() => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const type = management?.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    const search = management?.querySelector('[data-testid="smoke-failure-metadata-search"]');
    const preset = management?.querySelector('[data-testid="smoke-failure-metadata-date-preset-today"]');
    if (!(type instanceof HTMLSelectElement) || !(search instanceof HTMLInputElement) || !(preset instanceof HTMLButtonElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    type.value = 'login';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    setValue.call(search, '관리자');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    preset.click();
    return true;
  })()`);
  assert.equal(changed, true, "실패 정보 빠른 기간을 적용하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      const start = document.querySelector('[data-testid="smoke-failure-metadata-start-date"]');
      const end = document.querySelector('[data-testid="smoke-failure-metadata-end-date"]');
      return params.get('smoke_metadata_type') === 'login' &&
        params.get('smoke_metadata_q') === '관리자' &&
        params.get('smoke_metadata_period') === 'custom' &&
        params.get('smoke_metadata_from') === start?.value &&
        params.get('smoke_metadata_to') === end?.value &&
        start?.value === end?.value &&
        document.querySelector('[data-testid="smoke-failure-metadata-date-preset-today"]')?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('[data-testid="smoke-failure-metadata-result-count"]')?.textContent?.includes('조회 1/2건');
    })()`,
    timeoutMs,
    "실패 정보 오늘 빠른 기간이 URL과 결과에 반영되지 않았습니다",
  );
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-date-range"]') instanceof HTMLElement`,
    timeoutMs,
    "실패 정보 사용자 지정 날짜 입력이 표시되지 않았습니다",
  );
  const customRange = await evaluate(cdp, `(() => {
    const start = document.querySelector('[data-testid="smoke-failure-metadata-start-date"]');
    const end = document.querySelector('[data-testid="smoke-failure-metadata-end-date"]');
    if (!(start instanceof HTMLInputElement) || !(end instanceof HTMLInputElement)) return null;
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!setInputValue) return null;
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    setInputValue.call(start, startDate);
    start.dispatchEvent(new Event('input', { bubbles: true }));
    setInputValue.call(end, endDate);
    end.dispatchEvent(new Event('input', { bubbles: true }));
    return { endDate, startDate };
  })()`);
  assert.ok(customRange, "실패 정보 사용자 지정 날짜를 입력하지 못했습니다");
  await waitForCondition(
    cdp,
    `location.search.includes('smoke_metadata_type=login') &&
      location.search.includes('smoke_metadata_period=custom') &&
      location.search.includes('smoke_metadata_from=${customRange.startDate}') &&
      location.search.includes('smoke_metadata_to=${customRange.endDate}') &&
      new URLSearchParams(location.search).get('smoke_metadata_q') === '관리자' &&
      document.querySelector('[data-testid="smoke-failure-metadata-result-count"]')?.textContent?.includes('조회 1/2건')`,
    timeoutMs,
    "실패 정보 필터가 URL과 결과에 반영되지 않았습니다",
  );
  await checkSmokeFailureMetadataSavedFilters({ cdp, timeoutMs });

  const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  await fulfillJsonRequest(cdp, await requestPaused, fixture);
  await loaded;
  await waitForCondition(
    cdp,
    `(() => {
      const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
      if (management instanceof HTMLDetailsElement) management.open = true;
      const type = management?.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
      const period = management?.querySelector('[data-testid="smoke-failure-metadata-period-filter"]');
      const sort = management?.querySelector('[data-testid="smoke-failure-metadata-sort"]');
      const search = management?.querySelector('[data-testid="smoke-failure-metadata-search"]');
      const start = management?.querySelector('[data-testid="smoke-failure-metadata-start-date"]');
      const end = management?.querySelector('[data-testid="smoke-failure-metadata-end-date"]');
      const runLink = management?.querySelector('[data-testid="smoke-failure-metadata-run-link"]');
      return type?.value === 'login' && period?.value === 'custom' && sort?.value === 'run_asc' && search?.value === '관리자' &&
        start?.value === ${JSON.stringify(customRange.startDate)} &&
        end?.value === ${JSON.stringify(customRange.endDate)} &&
        runLink?.getAttribute('href')?.endsWith('/actions/runs/987') &&
        management?.querySelector('[data-testid="smoke-failure-metadata-result-count"]')?.textContent?.includes('조회 1/2건');
    })()`,
    timeoutMs,
    "실패 정보 필터가 새로고침 후 복원되지 않았습니다",
  );

  await checkSmokeFailureMetadataExport({ cdp, customRange });

  const hiddenSelectionCreated = await evaluate(cdp, `(() => {
    const type = document.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    if (!(type instanceof HTMLSelectElement)) return false;
    type.value = 'external_api';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(hiddenSelectionCreated, true, "선택 항목을 필터 밖으로 숨기지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const summary = document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]');
      const clear = document.querySelector('[data-testid="smoke-failure-metadata-clear-selection"]');
      return summary?.getAttribute('data-hidden-count') === '1' &&
        summary.textContent?.includes('선택 1건 · 현재 결과 0건 · 숨김 1건') &&
        clear instanceof HTMLButtonElement && !clear.disabled;
    })()`,
    timeoutMs,
    "필터 밖 숨김 선택 건수가 표시되지 않았습니다",
  );
  await checkSmokeFailureMetadataCleanupPreview({ cdp, timeoutMs });
  const allRecordsSelected = await evaluate(cdp, `(() => {
    const selectAll = document.querySelector('[data-testid="smoke-failure-metadata-select-all"]');
    if (!(selectAll instanceof HTMLButtonElement) || selectAll.disabled) return false;
    selectAll.click();
    return true;
  })()`);
  assert.equal(allRecordsSelected, true, "실패 정보 전체 기록을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]')?.textContent?.includes('선택 2건 · 현재 결과 0건 · 숨김 2건')`,
    timeoutMs,
    "실패 정보 전체 기록 선택 결과가 표시되지 않았습니다",
  );
  const visibleSelectionPrepared = await evaluate(cdp, `(() => {
    const period = document.querySelector('[data-testid="smoke-failure-metadata-period-filter"]');
    const search = document.querySelector('[data-testid="smoke-failure-metadata-search"]');
    if (!(period instanceof HTMLSelectElement) || !(search instanceof HTMLInputElement)) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(search, '');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    period.value = 'all';
    period.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(visibleSelectionPrepared, true, "현재 결과 선택 해제를 준비하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const summary = document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]');
      const clearVisible = document.querySelector('[data-testid="smoke-failure-metadata-clear-visible"]');
      return summary?.textContent?.includes('선택 2건 · 현재 결과 1건 · 숨김 1건') &&
        clearVisible instanceof HTMLButtonElement && !clearVisible.disabled;
    })()`,
    timeoutMs,
    "현재 결과 선택 해제 대상이 표시되지 않았습니다",
  );
  const visibleSelectionCleared = await evaluate(cdp, `(() => {
    const clearVisible = document.querySelector('[data-testid="smoke-failure-metadata-clear-visible"]');
    if (!(clearVisible instanceof HTMLButtonElement) || clearVisible.disabled) return false;
    clearVisible.click();
    return true;
  })()`);
  assert.equal(visibleSelectionCleared, true, "현재 결과 선택을 해제하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]')?.textContent?.includes('선택 1건 · 현재 결과 0건 · 숨김 1건')`,
    timeoutMs,
    "현재 결과 선택 해제가 필터 밖 선택을 보존하지 못했습니다",
  );
  const selectionCleared = await evaluate(cdp, `(() => {
    const clear = document.querySelector('[data-testid="smoke-failure-metadata-clear-selection"]');
    if (!(clear instanceof HTMLButtonElement) || clear.disabled) return false;
    clear.click();
    return true;
  })()`);
  assert.equal(selectionCleared, true, "실패 정보 선택 전체 해제를 실행하지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]')?.textContent === '선택 없음' &&
      document.querySelector('[data-testid="smoke-failure-metadata-selected-csv"]')?.disabled`,
    timeoutMs,
    "실패 정보 선택이 모두 해제되지 않았습니다",
  );

  await evaluate(cdp, `(() => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    for (const [testId, value] of [
      ['smoke-failure-metadata-type-filter', 'all'],
      ['smoke-failure-metadata-period-filter', 'all'],
      ['smoke-failure-metadata-sort', 'newest'],
    ]) {
      const select = management?.querySelector('[data-testid="' + testId + '"]');
      if (select instanceof HTMLSelectElement) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  })()`);
  await waitForCondition(
    cdp,
    `!location.search.includes('smoke_metadata_type') &&
      !location.search.includes('smoke_metadata_period') &&
      !location.search.includes('smoke_metadata_from') &&
      !location.search.includes('smoke_metadata_to') &&
      !location.search.includes('smoke_metadata_q') &&
      !location.search.includes('smoke_metadata_sort')`,
    timeoutMs,
    "실패 정보 기본 필터가 URL에서 제거되지 않았습니다",
  );
  await checkSmokeFailureMetadataCleanupSuccess({ cdp, fixture, timeoutMs });
}

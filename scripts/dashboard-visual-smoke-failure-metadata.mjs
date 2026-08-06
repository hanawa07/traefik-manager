import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";

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
        management.querySelector('[data-testid="smoke-failure-metadata-type-filter"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-period-filter"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-period-filter"] option[value="custom"]') instanceof HTMLOptionElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-date-preset-today"]') instanceof HTMLButtonElement;
    })()`,
    timeoutMs,
    "실패 정보 관리·내보내기 컨트롤을 찾지 못했습니다",
  );
  const changed = await evaluate(cdp, `(() => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const type = management?.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    const preset = management?.querySelector('[data-testid="smoke-failure-metadata-date-preset-today"]');
    if (!(type instanceof HTMLSelectElement) || !(preset instanceof HTMLButtonElement)) return false;
    type.value = 'login';
    type.dispatchEvent(new Event('change', { bubbles: true }));
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
      document.querySelector('[data-testid="smoke-failure-metadata-result-count"]')?.textContent?.includes('조회 1/2건')`,
    timeoutMs,
    "실패 정보 필터가 URL과 결과에 반영되지 않았습니다",
  );

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
      const start = management?.querySelector('[data-testid="smoke-failure-metadata-start-date"]');
      const end = management?.querySelector('[data-testid="smoke-failure-metadata-end-date"]');
      const runLink = management?.querySelector('[data-testid="smoke-failure-metadata-run-link"]');
      return type?.value === 'login' && period?.value === 'custom' &&
        start?.value === ${JSON.stringify(customRange.startDate)} &&
        end?.value === ${JSON.stringify(customRange.endDate)} &&
        runLink?.getAttribute('href')?.endsWith('/actions/runs/987') &&
        management?.querySelector('[data-testid="smoke-failure-metadata-result-count"]')?.textContent?.includes('조회 1/2건');
    })()`,
    timeoutMs,
    "실패 정보 필터가 새로고침 후 복원되지 않았습니다",
  );

  const exported = await evaluate(cdp, `(async () => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const captureCsv = async (button) => {
      if (!(button instanceof HTMLButtonElement) || button.disabled) return null;
      const originalCreateObjectUrl = URL.createObjectURL;
      const originalClick = HTMLAnchorElement.prototype.click;
      let blob = null;
      let filename = '';
      try {
        URL.createObjectURL = (value) => { blob = value; return 'blob:smoke-failure-metadata'; };
        HTMLAnchorElement.prototype.click = function () { filename = this.download; };
        button.click();
        return { content: blob ? await blob.text() : '', filename };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
        HTMLAnchorElement.prototype.click = originalClick;
      }
    };
    const filtered = await captureCsv(
      management?.querySelector('[data-testid="smoke-failure-metadata-filtered-csv"]'),
    );
    const checkbox = management?.querySelector('input[aria-label="실행 #987 선택"]');
    if (!(checkbox instanceof HTMLInputElement)) return null;
    checkbox.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const selected = await captureCsv(
      management?.querySelector('[data-testid="smoke-failure-metadata-selected-csv"]'),
    );
    return { filtered, selected };
  })()`);
  assert.ok(exported?.filtered, "현재 필터 결과 CSV를 캡처하지 못했습니다");
  assert.ok(exported.selected, "선택 실패 정보 CSV를 캡처하지 못했습니다");
  assert.match(exported.filtered.filename, /^traefik-manager-smoke-failure-metadata-filtered-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.selected.filename, /^traefik-manager-smoke-failure-metadata-selected-\d{4}-\d{2}-\d{2}\.csv$/);
  for (const result of [exported.filtered, exported.selected]) {
    assert.match(result.content, /^"run_id","failure_type","captured_at"/);
    assert.match(result.content, /"987","login"/);
    assert.doesNotMatch(result.content, /"986","external_api"/);
  }
  assert.match(
    exported.filtered.content,
    /"filter_type","filter_period","filter_start_date","filter_end_date","filter_timezone"/,
  );
  assert.match(
    exported.filtered.content,
    new RegExp(`"login","custom","${customRange.startDate}","${customRange.endDate}",`),
  );

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
    for (const testId of ['smoke-failure-metadata-type-filter', 'smoke-failure-metadata-period-filter']) {
      const select = management?.querySelector('[data-testid="' + testId + '"]');
      if (select instanceof HTMLSelectElement) {
        select.value = 'all';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  })()`);
  await waitForCondition(
    cdp,
    `!location.search.includes('smoke_metadata_type') &&
      !location.search.includes('smoke_metadata_period') &&
      !location.search.includes('smoke_metadata_from') &&
      !location.search.includes('smoke_metadata_to')`,
    timeoutMs,
    "실패 정보 기본 필터가 URL에서 제거되지 않았습니다",
  );
}

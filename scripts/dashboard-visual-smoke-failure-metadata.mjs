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
        management.querySelector('[data-testid="smoke-failure-metadata-selected-export"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-selected-csv"]') instanceof HTMLButtonElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-type-filter"]') instanceof HTMLSelectElement &&
        management.querySelector('[data-testid="smoke-failure-metadata-period-filter"]')?.querySelector('option[value="custom"]');
    })()`,
    timeoutMs,
    "실패 정보 관리·내보내기 컨트롤을 찾지 못했습니다",
  );
  const changed = await evaluate(cdp, `(() => {
    const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
    const type = management?.querySelector('[data-testid="smoke-failure-metadata-type-filter"]');
    const period = management?.querySelector('[data-testid="smoke-failure-metadata-period-filter"]');
    if (!(type instanceof HTMLSelectElement) || !(period instanceof HTMLSelectElement)) return false;
    type.value = 'login';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    period.value = 'custom';
    period.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "실패 정보 필터를 변경하지 못했습니다");
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
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    start.value = startDate;
    start.dispatchEvent(new Event('change', { bubbles: true }));
    end.value = endDate;
    end.dispatchEvent(new Event('change', { bubbles: true }));
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
    const checkbox = management?.querySelector('input[aria-label="실행 #987 선택"]');
    if (!(checkbox instanceof HTMLInputElement)) return null;
    checkbox.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const button = management?.querySelector('[data-testid="smoke-failure-metadata-selected-csv"]');
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
  })()`);
  assert.ok(exported, "선택 실패 정보 CSV를 캡처하지 못했습니다");
  assert.match(exported.filename, /^traefik-manager-smoke-failure-metadata-selected-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exported.content, /^"run_id","failure_type","captured_at"/);
  assert.match(exported.content, /"987","login"/);
  assert.doesNotMatch(exported.content, /"986","external_api"/);

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

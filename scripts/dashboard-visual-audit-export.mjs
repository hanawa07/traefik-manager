import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkAuditCsvExports({ cdp, timeoutMs, today }) {
  const exportResult = await evaluate(cdp, `(async () => {
    const link = document.querySelector('a[aria-label="현재 감사 조건 CSV 다운로드"]');
    if (!link) return null;
    const url = new URL(link.href);
    const response = await fetch(url);
    const bytes = Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 3));
    return {
      disposition: response.headers.get('content-disposition'),
      endDate: url.searchParams.get('end_date'),
      hasLimit: url.searchParams.has('limit'),
      hasOffset: url.searchParams.has('offset'),
      ok: response.ok,
      startDate: url.searchParams.get('start_date'),
      bytes,
    };
  })()`);
  assert.ok(exportResult?.ok, "감사 로그 CSV 응답을 받지 못했습니다");
  assert.equal(exportResult.startDate, today, "감사 로그 CSV에 시작일이 반영되지 않았습니다");
  assert.equal(exportResult.endDate, today, "감사 로그 CSV에 종료일이 반영되지 않았습니다");
  assert.equal(exportResult.hasLimit || exportResult.hasOffset, false, "감사 로그 CSV에 페이지 조건이 포함됐습니다");
  assert.deepEqual(exportResult.bytes, [239, 187, 191], "감사 로그 CSV UTF-8 BOM이 없습니다");
  assert.match(exportResult.disposition || "", /audit-logs-\d{8}\.csv/, "감사 로그 CSV 파일명이 없습니다");

  const presetResult = await evaluate(cdp, `(async () => {
    const select = document.querySelector('select[aria-label="Secret 회전 CSV 기간"]');
    if (!select) return null;
    select.value = '30';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const link = document.querySelector('a[aria-label="Secret 회전 CSV 다운로드"]');
    if (!link?.href) return null;
    const url = new URL(link.href);
    const response = await fetch(url);
    return {
      event: url.searchParams.get('event'),
      periodDays: url.searchParams.get('period_days'),
      ok: response.ok,
    };
  })()`);
  assert.ok(presetResult?.ok, "Secret 회전 CSV 응답을 받지 못했습니다");
  assert.equal(presetResult.periodDays, "30", "Secret 회전 CSV 기간이 반영되지 않았습니다");
  assert.equal(presetResult.event, "smoke_rotation_result", "Secret 회전 CSV 조건이 고정되지 않았습니다");
  await assertRotationCount({ cdp, timeoutMs });

  const customResult = await evaluate(cdp, `(async () => {
    const settle = () => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const select = document.querySelector('select[aria-label="Secret 회전 CSV 기간"]');
    if (!select) return null;
    select.value = 'custom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const disabledLink = document.querySelector('a[aria-label="Secret 회전 CSV 다운로드"]');
    const disabledBefore = disabledLink?.getAttribute('aria-disabled');
    const hadHrefBefore = disabledLink?.hasAttribute('href');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const start = document.querySelector('input[aria-label="Secret 회전 CSV 시작일"]');
    if (!setter || !start) return null;
    setter.call(start, ${JSON.stringify(today)});
    start.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const end = document.querySelector('input[aria-label="Secret 회전 CSV 종료일"]');
    if (!end) return null;
    setter.call(end, ${JSON.stringify(today)});
    end.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const link = document.querySelector('a[aria-label="Secret 회전 CSV 다운로드"]');
    if (!link?.href) return null;
    const url = new URL(link.href);
    const response = await fetch(url);
    return {
      disabledBefore,
      endDate: url.searchParams.get('end_date'),
      event: url.searchParams.get('event'),
      fitsViewport: document.documentElement.scrollWidth <= window.innerWidth + 1,
      hadHrefBefore,
      ok: response.ok,
      periodDays: url.searchParams.get('period_days'),
      startDate: url.searchParams.get('start_date'),
    };
  })()`);
  assert.ok(customResult?.ok, "사용자 지정 Secret 회전 CSV 응답을 받지 못했습니다");
  assert.equal(customResult.disabledBefore, "true", "날짜 선택 전 CSV 링크가 비활성화되지 않았습니다");
  assert.equal(customResult.hadHrefBefore, false, "날짜 선택 전 CSV 링크에 주소가 남았습니다");
  assert.equal(customResult.startDate, today, "Secret 회전 CSV 시작일이 반영되지 않았습니다");
  assert.equal(customResult.endDate, today, "Secret 회전 CSV 종료일이 반영되지 않았습니다");
  assert.equal(customResult.periodDays, null, "사용자 지정 CSV에 상대 기간이 함께 적용됐습니다");
  assert.equal(customResult.event, "smoke_rotation_result", "사용자 지정 CSV 이벤트 조건이 누락됐습니다");
  assert.equal(customResult.fitsViewport, true, "Secret 회전 CSV 날짜 입력이 화면 너비를 넘습니다");
  await assertRotationCount({ cdp, timeoutMs });

  const emptyRangeChanged = await evaluate(cdp, `(async () => {
    const settle = () => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const start = document.querySelector('input[aria-label="Secret 회전 CSV 시작일"]');
    const end = document.querySelector('input[aria-label="Secret 회전 CSV 종료일"]');
    if (!setter || !start || !end) return false;
    setter.call(end, '2099-01-01');
    end.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    setter.call(start, '2099-01-01');
    start.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    return true;
  })()`);
  assert.equal(emptyRangeChanged, true, "Secret 회전 CSV 0건 날짜 범위를 설정하지 못했습니다");
  const emptyResult = await assertRotationCount({ cdp, timeoutMs });
  assert.equal(emptyResult.actual, 0, "Secret 회전 CSV 0건 조건이 비어 있지 않습니다");
  assert.match(emptyResult.text, /CSV에는 헤더만 포함됩니다/);

  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-testid="secret-rotation-export-latest"]')) &&
      Boolean(document.querySelector('[data-testid="secret-rotation-export-today"]'))`,
    timeoutMs,
    "Secret 회전 CSV 복구 버튼을 불러오지 못했습니다",
  );
  const latestRecovery = await evaluate(cdp, `(async () => {
    const button = document.querySelector('[data-testid="secret-rotation-export-latest"]');
    const latestDate = button?.getAttribute('data-latest-date');
    const latestStatus = button?.getAttribute('data-latest-status');
    const response = await fetch('/api/v1/audit?event=smoke_rotation_result&limit=1&offset=0');
    const latest = response.ok ? (await response.json())[0] : null;
    const expectedStatus = latest?.event === 'smoke_rotation_succeeded'
      ? 'success'
      : latest?.event === 'smoke_rotation_failed' ? 'failure' : null;
    const text = button?.textContent || '';
    button?.click();
    return { clicked: Boolean(button), expectedStatus, latestDate, latestStatus, text };
  })()`);
  assert.equal(latestRecovery.clicked, true, "Secret 회전 CSV 최근 결과 날짜 버튼이 없습니다");
  assert.match(latestRecovery.latestDate || "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(latestRecovery.latestStatus, latestRecovery.expectedStatus, "최근 회전 결과 상태가 다릅니다");
  assert.match(
    latestRecovery.text,
    latestRecovery.latestStatus === "success" ? /성공/ : /실패/,
    "최근 회전 결과 상태 문구가 없습니다",
  );
  await waitForCondition(
    cdp,
    `(() => {
      const select = document.querySelector('select[aria-label="Secret 회전 CSV 기간"]');
      const start = document.querySelector('input[aria-label="Secret 회전 CSV 시작일"]');
      const end = document.querySelector('input[aria-label="Secret 회전 CSV 종료일"]');
      return select?.value === 'custom' && start?.value === ${JSON.stringify(latestRecovery.latestDate)} &&
        end?.value === ${JSON.stringify(latestRecovery.latestDate)};
    })()`,
    timeoutMs,
    "Secret 회전 CSV가 최근 결과 날짜로 복구되지 않았습니다",
  );
  const latestResult = await assertRotationCount({ cdp, timeoutMs });
  assert.ok(latestResult.actual > 0, "최근 결과 날짜에 Secret 회전 이력이 없습니다");
  assert.equal(latestResult.startDate, latestRecovery.latestDate, "최근 결과 시작일이 다릅니다");
  assert.equal(latestResult.endDate, latestRecovery.latestDate, "최근 결과 종료일이 다릅니다");
}

async function assertRotationCount({ cdp, timeoutMs }) {
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="secret-rotation-export-count"]')?.getAttribute('data-count-status') === 'ready'`,
    timeoutMs,
    "Secret 회전 CSV 예상 건수를 불러오지 못했습니다",
  );
  const result = await evaluate(cdp, `(async () => {
    const count = document.querySelector('[data-testid="secret-rotation-export-count"]');
    const link = document.querySelector('a[aria-label="Secret 회전 CSV 다운로드"]');
    if (!link?.href) return null;
    const url = new URL(link.href);
    url.pathname = url.pathname.slice(0, -'/export.csv'.length);
    url.searchParams.set('limit', '1');
    const response = await fetch(url);
    return {
      actual: Number(count?.getAttribute('data-result-count')),
      endDate: url.searchParams.get('end_date'),
      expected: Number(response.headers.get('x-total-count')),
      ok: response.ok,
      startDate: url.searchParams.get('start_date'),
      text: count?.textContent || '',
    };
  })()`);
  assert.equal(result?.ok, true, "Secret 회전 CSV 예상 건수 API 응답을 받지 못했습니다");
  assert.equal(result.actual, result.expected, "Secret 회전 CSV 예상 건수가 조회 조건과 일치하지 않습니다");
  assert.match(result.text, new RegExp(`${result.expected.toLocaleString("ko-KR")}건`));
  return result;
}

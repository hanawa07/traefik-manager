import assert from "node:assert/strict";

import { checkManagerHttpAuditAutoExpand } from "./dashboard-visual-audit-manager-http.mjs";
import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import {
  clickAriaLabel,
  evaluate,
  reloadPage,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

export async function checkCertificateDrawer({ artifactDir, cdp, profile, timeoutMs }) {
  const opened = await clickButton(cdp, "상세 보기");
  if (!opened) return false;

  await waitForDialog(cdp, "인증서 상세", timeoutMs);
  await assertDialogFitsViewport(cdp, "인증서 상세");
  await captureVisualScreenshot({
    artifactDir,
    cdp,
    name: `${profile.id}-certificate-drawer`,
  });
  await clickAriaLabel(cdp, "인증서 상세 닫기");
  await waitForDialogClosed(cdp, "인증서 상세", timeoutMs);
  return true;
}

export async function checkOptionalAdminModal({ artifactDir, cdp, profile, timeoutMs }) {
  const opened = await clickButton(cdp, "사용자 추가");
  if (!opened) return false;

  await waitForDialog(cdp, "사용자 추가", timeoutMs);
  await assertDialogFitsViewport(cdp, "사용자 추가");
  await captureVisualScreenshot({
    artifactDir,
    cdp,
    name: `${profile.id}-user-create-modal`,
  });
  await clickAriaLabel(cdp, "닫기");
  await waitForDialogClosed(cdp, "사용자 추가", timeoutMs);
  return true;
}

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
  await waitForQueryParam(cdp, "filter", "manager_health", timeoutMs);
  await waitForQueryParamAbsent(cdp, "page", timeoutMs);
  await changeTextInput(cdp, "감사 로그 검색", "lizstudio");
  await waitForQueryParam(cdp, "q", "lizstudio", timeoutMs);

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
    await waitForQueryParam(cdp, queryKey, value, timeoutMs);
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
  await waitForQueryParamAbsent(cdp, "q", timeoutMs);
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
  await changeTextInput(cdp, "감사 시작일", today);
  await waitForQueryParam(cdp, "start_date", today, timeoutMs);
  await waitForQueryParamAbsent(cdp, "period", timeoutMs);
  await changeTextInput(cdp, "감사 종료일", today);
  await waitForQueryParam(cdp, "end_date", today, timeoutMs);
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
  const exportResult = await evaluate(cdp, `(async () => {
    const link = Array.from(document.querySelectorAll('a')).find(
      (item) => item.textContent?.includes('현재 조건 CSV')
    );
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
  const rotationExportResult = await evaluate(cdp, `(async () => {
    const select = document.querySelector('select[aria-label="Secret 회전 CSV 기간"]');
    if (!select) return null;
    select.value = '30';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const link = document.querySelector('a[aria-label="Secret 회전 CSV 다운로드"]');
    if (!link) return null;
    const url = new URL(link.href);
    const response = await fetch(url);
    return {
      event: url.searchParams.get('event'),
      periodDays: url.searchParams.get('period_days'),
      ok: response.ok,
    };
  })()`);
  assert.ok(rotationExportResult?.ok, "Secret 회전 CSV 응답을 받지 못했습니다");
  assert.equal(rotationExportResult.periodDays, "30", "Secret 회전 CSV 기간이 반영되지 않았습니다");
  assert.equal(
    rotationExportResult.event,
    "smoke_rotation_result",
    "Secret 회전 CSV 조건이 고정되지 않았습니다",
  );
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
  return true;
}

async function assertAuditPagination(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('nav[aria-label="감사 로그 페이지"]'))`,
    timeoutMs,
    "감사 로그 페이지네이션이 표시되지 않았습니다",
  );
  const snapshot = await evaluate(cdp, `(() => {
    const nav = document.querySelector('nav[aria-label="감사 로그 페이지"]');
    const total = Number(nav?.getAttribute('data-audit-total'));
    const next = document.querySelector('button[aria-label="다음 감사 로그 페이지"]');
    return { nextDisabled: next?.disabled, total };
  })()`);
  assert.ok(Number.isInteger(snapshot.total) && snapshot.total >= 0, "감사 로그 총 건수가 올바르지 않습니다");
  assert.equal(snapshot.nextDisabled, snapshot.total <= 50, "감사 로그 다음 페이지 상태가 총 건수와 맞지 않습니다");
  if (snapshot.total > 50) {
    await clickAriaLabel(cdp, "다음 감사 로그 페이지");
    await waitForQueryParam(cdp, "page", "2", timeoutMs);
    await waitForCondition(
      cdp,
      `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '2' &&
        document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
      timeoutMs,
      "감사 로그 2페이지 결과가 로드되지 않았습니다",
    );
  }
  const pageSizeChanged = await evaluate(cdp, `(() => {
    const select = document.querySelector('select[aria-label="감사 로그 페이지 크기"]');
    if (!select) return false;
    select.value = '100';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(pageSizeChanged, true, "감사 로그 페이지 크기 선택을 찾지 못했습니다");
  await waitForQueryParam(cdp, "page_size", "100", timeoutMs);
  await waitForQueryParamAbsent(cdp, "page", timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '1' &&
      document.querySelector('select[aria-label="감사 로그 페이지 크기"]')?.value === '100' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "감사 로그 페이지 크기 변경 결과가 로드되지 않았습니다",
  );
  const targetPage = Math.min(3, Math.ceil(snapshot.total / 100));
  if (targetPage <= 1) return;
  const directPageChanged = await evaluate(cdp, `(() => {
    const input = document.querySelector('input[aria-label="감사 로그 페이지 번호"]');
    const button = document.querySelector('button[aria-label="감사 로그 페이지 이동"]');
    if (!input || !button) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${targetPage});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    return true;
  })()`);
  assert.equal(directPageChanged, true, "감사 로그 페이지 번호 이동 입력을 찾지 못했습니다");
  await waitForQueryParam(cdp, "page", String(targetPage), timeoutMs);
  await waitForCondition(
    cdp,
    `document.querySelector('nav[aria-label="감사 로그 페이지"]')?.getAttribute('data-audit-page') === '${targetPage}' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "감사 로그 직접 지정 페이지가 로드되지 않았습니다",
  );
}

async function assertAuditFilterLayout(cdp, mobile) {
  const labels = ["감사 기간", "감사 시작일", "감사 종료일", "Manager 소스", "Manager 상태", "Manager 집계 기간", "전송 상태", "알림 채널"];
  const snapshot = await evaluate(cdp, `(() => {
    const fields = ${JSON.stringify(labels)}.map((name) => {
      const field = document.querySelector('[aria-label="' + name + '"]');
      const label = field?.closest('label');
      const rect = label?.getBoundingClientRect();
      return rect ? { top: Math.round(rect.top), width: rect.width } : null;
    }).filter(Boolean);
    const searchRect = document.querySelector('input[aria-label="감사 로그 검색"]')
      ?.closest('label')?.getBoundingClientRect();
    const resetRect = document.querySelector('button[aria-label="감사 필터 전체 초기화"]')
      ?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      fields,
      resetWidth: resetRect?.width || 0,
      searchWidth: searchRect?.width || 0,
      viewportWidth: window.innerWidth,
    };
  })()`);
  assert.equal(snapshot.fields.length, labels.length, "감사 로그 필터 필드가 누락됐습니다");
  assert.ok(
    snapshot.documentWidth <= snapshot.viewportWidth + 1,
    "감사 로그 필터가 화면 너비를 넘습니다",
  );
  const rowCount = new Set(snapshot.fields.map((field) => field.top)).size;
  if (mobile) {
    assert.equal(rowCount, labels.length, "모바일 감사 로그 필터가 한 열로 배치되지 않았습니다");
    assert.ok(
      snapshot.fields.every((field) => field.width >= snapshot.viewportWidth * 0.8),
      "모바일 감사 로그 필터 너비가 너무 좁습니다",
    );
    assert.ok(
      snapshot.searchWidth >= snapshot.viewportWidth * 0.8 &&
        snapshot.resetWidth >= snapshot.viewportWidth * 0.8,
      "모바일 감사 로그 검색과 초기화 버튼 너비가 너무 좁습니다",
    );
  } else {
    assert.equal(rowCount, 2, "데스크톱 감사 로그 필터가 네 열로 배치되지 않았습니다");
  }
}

async function assertManagerCrossCount(cdp, timeoutMs) {
  const count = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit/manager-health-summary?window_minutes=1440');
    if (!response.ok) return null;
    const summary = await response.json();
    return summary.api_unhealthy_count;
  })()`);
  assert.equal(typeof count, "number", "Manager 교차 집계 API 수치를 확인하지 못했습니다");
  const expected = `(${count})`;
  await waitForCondition(
    cdp,
    `(() => {
      const source = document.querySelector('select[aria-label="Manager 소스"]');
      const status = document.querySelector('select[aria-label="Manager 상태"]');
      const sourceText = Array.from(source?.options || []).find((option) => option.value === 'api')?.textContent || '';
      const statusText = Array.from(status?.options || []).find((option) => option.value === 'unhealthy')?.textContent || '';
      return sourceText.includes(${JSON.stringify(expected)}) && statusText.includes(${JSON.stringify(expected)});
    })()`,
    timeoutMs,
    "Manager 소스와 상태의 교차 집계 수치가 일치하지 않습니다",
  );
}

async function waitForQueryParam(cdp, key, value, timeoutMs) {
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get(${JSON.stringify(key)}) === ${JSON.stringify(value)}`,
    timeoutMs,
    `감사 로그 ${key} 필터가 URL에 저장되지 않았습니다`,
  );
}

async function waitForQueryParamAbsent(cdp, key, timeoutMs) {
  await waitForCondition(
    cdp,
    `!new URLSearchParams(location.search).has(${JSON.stringify(key)})`,
    timeoutMs,
    `감사 로그 ${key} 값이 URL에서 제거되지 않았습니다`,
  );
}

async function changeTextInput(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(`input[aria-label="${label}"]`)});
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 입력 필드를 찾지 못했습니다`);
}

export async function checkMobileSidebar({ artifactDir, cdp, profile, timeoutMs }) {
  if (!profile.mobile) return false;

  await clickAriaLabel(cdp, "메뉴 열기");
  await waitForCondition(
    cdp,
    `(() => {
      const sidebar = document.querySelector('#dashboard-sidebar');
      const toggle = document.querySelector('[aria-controls="dashboard-sidebar"]');
      return Boolean(
        sidebar &&
        toggle?.getAttribute('aria-expanded') === 'true' &&
        sidebar.getBoundingClientRect().x >= -1
      );
    })()`,
    timeoutMs,
    "모바일 메뉴가 열리지 않았습니다",
  );

  const snapshot = await evaluate(cdp, `(() => {
    const sidebar = document.querySelector('#dashboard-sidebar');
    const rect = sidebar?.getBoundingClientRect();
    return rect ? {
      height: rect.height,
      navLinks: sidebar.querySelectorAll('nav a').length,
      scrollWidth: sidebar.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
      x: rect.x,
    } : null;
  })()`);
  assert.ok(snapshot, "모바일 메뉴를 찾지 못했습니다");
  assert.ok(snapshot.x >= -1, "모바일 메뉴가 화면 안으로 들어오지 않았습니다");
  assert.ok(snapshot.width <= snapshot.viewportWidth + 1, "모바일 메뉴가 화면 폭을 넘습니다");
  assert.ok(snapshot.height <= snapshot.viewportHeight + 1, "모바일 메뉴가 화면 높이를 넘습니다");
  assert.ok(snapshot.scrollWidth <= snapshot.width + 1, "모바일 메뉴 내부가 가로로 넘칩니다");
  assert.ok(snapshot.navLinks >= 7, "모바일 메뉴의 탐색 링크가 누락됐습니다");

  await captureVisualScreenshot({ artifactDir, cdp, name: `${profile.id}-sidebar-open` });
  await clickAriaLabel(cdp, "메뉴 닫기");
  await waitForCondition(
    cdp,
    `(() => {
      const sidebar = document.querySelector('#dashboard-sidebar');
      const toggle = document.querySelector('[aria-controls="dashboard-sidebar"]');
      return Boolean(
        sidebar &&
        toggle?.getAttribute('aria-expanded') === 'false' &&
        sidebar.getBoundingClientRect().right <= 1
      );
    })()`,
    timeoutMs,
    "모바일 메뉴가 닫히지 않았습니다",
  );
  return true;
}

async function assertDialogFitsViewport(cdp, label) {
  const snapshot = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const rect = dialog.getBoundingClientRect();
    return {
      height: rect.height,
      scrollWidth: dialog.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
    };
  })()`);
  assert.ok(snapshot, `${label}: 대화상자를 찾지 못했습니다`);
  assert.ok(snapshot.width <= snapshot.viewportWidth + 1, `${label}: 대화상자가 화면 폭을 넘습니다`);
  assert.ok(snapshot.height <= snapshot.viewportHeight + 1, `${label}: 대화상자가 화면 높이를 넘습니다`);
  assert.ok(snapshot.scrollWidth <= snapshot.width + 1, `${label}: 대화상자 내부가 가로로 넘칩니다`);
}

async function clickButton(cdp, text) {
  return evaluate(
    cdp,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (item) => item.textContent?.trim().includes(${JSON.stringify(text)})
      );
      button?.click();
      return Boolean(button);
    })()`,
  );
}

async function waitForDialog(cdp, label, timeoutMs) {
  await waitForCondition(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && (dialog.getAttribute('aria-label') || '').includes(${JSON.stringify(label)}));
    })()`,
    timeoutMs,
    `${label}: 대화상자가 열리지 않았습니다`,
  );
}

async function waitForDialogClosed(cdp, label, timeoutMs) {
  await waitForCondition(
    cdp,
    `!document.querySelector('[role="dialog"]')`,
    timeoutMs,
    `${label}: 대화상자가 닫히지 않았습니다`,
  );
}

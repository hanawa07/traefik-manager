import assert from "node:assert/strict";

import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";

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
  const managerFound = await evaluate(cdp, `(() => {
    const manager = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Manager 전체')
    );
    manager?.click();
    return Boolean(manager);
  })()`);
  assert.equal(managerFound, true, "감사 로그 Manager 필터를 찾지 못했습니다");
  await waitForQueryParam(cdp, "filter", "manager_health", timeoutMs);

  const selectChanges = [
    ["Manager 소스", "watchdog", "manager_source"],
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
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    cdp,
    `(() => {
      const manager = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Manager 전체')
      );
      return manager?.getAttribute('aria-pressed') === 'true' &&
        document.querySelector('select[aria-label="Manager 소스"]')?.value === 'watchdog' &&
        document.querySelector('select[aria-label="Manager 상태"]')?.value === 'unhealthy' &&
        document.querySelector('select[aria-label="전송 상태"]')?.value === 'failure' &&
        document.querySelector('select[aria-label="알림 채널"]')?.value === 'telegram' &&
        document.querySelector('select[aria-label="Manager 집계 기간"]')?.value === '1440';
    })()`,
    timeoutMs,
    "새로고침 후 감사 로그 필터가 복원되지 않았습니다",
  );
  return true;
}

async function assertAuditFilterLayout(cdp, mobile) {
  const labels = ["Manager 소스", "Manager 상태", "Manager 집계 기간", "전송 상태", "알림 채널"];
  const snapshot = await evaluate(cdp, `(() => {
    const fields = ${JSON.stringify(labels)}.map((name) => {
      const select = document.querySelector('select[aria-label="' + name + '"]');
      const label = select?.closest('label');
      const rect = label?.getBoundingClientRect();
      return rect ? { top: Math.round(rect.top), width: rect.width } : null;
    }).filter(Boolean);
    return {
      documentWidth: document.documentElement.scrollWidth,
      fields,
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
  } else {
    assert.equal(rowCount, 1, "데스크톱 감사 로그 필터가 한 행으로 배치되지 않았습니다");
  }
}

async function assertManagerCrossCount(cdp, timeoutMs) {
  const count = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit/manager-health-summary?window_minutes=1440');
    if (!response.ok) return null;
    const summary = await response.json();
    return summary.watchdog_unhealthy_count;
  })()`);
  assert.equal(typeof count, "number", "Manager 교차 집계 API 수치를 확인하지 못했습니다");
  const expected = `(${count})`;
  await waitForCondition(
    cdp,
    `(() => {
      const source = document.querySelector('select[aria-label="Manager 소스"]');
      const status = document.querySelector('select[aria-label="Manager 상태"]');
      const sourceText = Array.from(source?.options || []).find((option) => option.value === 'watchdog')?.textContent || '';
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

async function clickAriaLabel(cdp, label) {
  const clicked = await evaluate(
    cdp,
    `(() => {
      const button = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
      button?.click();
      return Boolean(button);
    })()`,
  );
  assert.equal(clicked, true, `${label}: 버튼을 찾지 못했습니다`);
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

async function waitForCondition(cdp, expression, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "대화상자 검사 실패");
  }
  return response.result.value;
}

import assert from "node:assert/strict";

import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import {
  clickAriaLabel,
  evaluate,
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

export async function checkOptionalAdminModal({ artifactDir, canManageUsers, cdp, profile, timeoutMs }) {
  const opened = await clickButton(cdp, "사용자 추가");
  assert.equal(opened, canManageUsers, "세션 역할과 사용자 추가 권한이 다릅니다");
  if (!canManageUsers) return false;

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

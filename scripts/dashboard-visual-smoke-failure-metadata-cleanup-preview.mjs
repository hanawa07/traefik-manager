import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeFailureMetadataCleanupPreview({ cdp, timeoutMs }) {
  const opened = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-cleanup"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(opened, true, "실패 정보 삭제 미리보기를 열지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const preview = document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview"]');
      const summary = preview?.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview-summary"]');
      const confirm = preview?.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview-confirm"]');
      return preview?.textContent?.includes('실행 #987') &&
        preview.textContent.includes('로그인') &&
        preview.textContent.includes('관리자 로그인 검사 실패') &&
        preview.textContent.includes('복구할 수 없습니다') &&
        summary?.getAttribute('data-selected-count') === '1' &&
        summary?.getAttribute('data-hidden-count') === '1' &&
        confirm instanceof HTMLButtonElement && confirm.textContent?.includes('1건 삭제');
    })()`,
    timeoutMs,
    "실패 정보 삭제 대상과 숨김 건수가 미리보기에 표시되지 않았습니다",
  );

  const canceled = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview-cancel"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(canceled, true, "실패 정보 삭제 미리보기를 취소하지 못했습니다");
  await waitForCondition(
    cdp,
    `!document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview"]') &&
      document.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]')?.textContent?.includes('선택 1건 · 현재 결과 0건 · 숨김 1건')`,
    timeoutMs,
    "삭제 미리보기 취소 후 선택 상태가 보존되지 않았습니다",
  );
}

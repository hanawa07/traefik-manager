import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { fulfillJsonRequest } from "./dashboard-visual-smoke-history-fixture.mjs";

const CLEANUP_PATH = "/api/v1/settings/smoke-failure-metadata/cleanup";

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

export async function checkSmokeFailureMetadataCleanupSuccess({
  cdp,
  fixture,
  timeoutMs,
}) {
  const selected = await evaluate(cdp, `(() => {
    const checkbox = document.querySelector('input[aria-label="실행 #987 선택"]');
    if (!(checkbox instanceof HTMLInputElement)) return false;
    checkbox.click();
    return true;
  })()`);
  assert.equal(selected, true, "성공 경로 삭제 대상을 선택하지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const cleanup = document.querySelector('[data-testid="smoke-failure-metadata-cleanup"]');
      return cleanup instanceof HTMLButtonElement && !cleanup.disabled;
    })()`,
    timeoutMs,
    "선택 후 삭제 미리보기 버튼이 활성화되지 않았습니다",
  );
  const opened = await evaluate(cdp, `(() => {
    const cleanup = document.querySelector('[data-testid="smoke-failure-metadata-cleanup"]');
    if (!(cleanup instanceof HTMLButtonElement) || cleanup.disabled) return false;
    cleanup.click();
    return true;
  })()`);
  assert.equal(opened, true, "성공 경로 삭제 미리보기를 열지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview-confirm"]') instanceof HTMLButtonElement`,
    timeoutMs,
    "성공 경로 삭제 확인 버튼이 표시되지 않았습니다",
  );

  const cleanupRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  const confirmed = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview-confirm"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(confirmed, true, "실패 정보 삭제 확인을 실행하지 못했습니다");
  const cleanupPaused = await cleanupRequest;
  assert.equal(cleanupPaused.request.method, "POST");
  assert.equal(new URL(cleanupPaused.request.url).pathname, CLEANUP_PATH);
  assert.deepEqual(JSON.parse(cleanupPaused.request.postData || "{}"), { run_ids: [987] });

  const refreshRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
  await fulfillJsonRequest(cdp, cleanupPaused, { deleted_count: 1, retained_count: 1 });
  const refreshPaused = await refreshRequest;
  assert.equal(refreshPaused.request.method, "GET");
  assert.equal(
    new URL(refreshPaused.request.url).pathname,
    "/api/v1/settings/smoke-rotation",
  );
  const refreshedFixture = {
    ...fixture,
    monitoring_failure_metadata_count: 1,
    monitoring_failure_metadata_entries: fixture.monitoring_failure_metadata_entries.filter(
      (entry) => entry.run_id !== 987,
    ),
  };
  await fulfillJsonRequest(cdp, refreshPaused, refreshedFixture);

  await waitForCondition(
    cdp,
    `(() => {
      const management = document.querySelector('[data-testid="smoke-failure-metadata-management"]');
      return !document.querySelector('[data-testid="smoke-failure-metadata-cleanup-preview"]') &&
        management?.querySelector('[data-testid="smoke-failure-metadata-summary"]')?.textContent?.includes('조회 1/1건 · 선택 0건 · 조건 0개') &&
        management?.querySelector('[data-testid="smoke-failure-metadata-notice"]')?.textContent?.includes('1건을 정리했습니다') &&
        management?.querySelector('[data-testid="smoke-failure-metadata-selection-summary"]')?.textContent === '선택 없음' &&
        !management?.querySelector('input[aria-label="실행 #987 선택"]');
    })()`,
    timeoutMs,
    "가짜 삭제 성공 응답이 목록·선택·안내에 반영되지 않았습니다",
  );
}

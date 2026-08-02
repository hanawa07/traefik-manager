import assert from "node:assert/strict";

import { evaluate, reloadPage, waitForCondition } from "./dashboard-visual-runtime.mjs";

export function assertSmokeStatisticsHistory(summary) {
  assert.equal(summary.historyFound, true, "스모크 로컬 장기 추이를 찾지 못했습니다");
  assert.equal(summary.historyOpen, true, "스모크 로컬 장기 추이가 펼쳐지지 않았습니다");
  assert.match(summary.snapshotText || "", /GitHub API를 추가 호출하지 않고/);
  assert.match(summary.snapshotText || "", /대시보드를 열지 않아도 직접 기록/);
  assert.match(summary.snapshotText || "", /새 콜백 저장 시 지난 기록을.*자동 정리/s);
  assert.ok(Number.isInteger(summary.snapshotCount) && summary.snapshotCount >= 0);
  assert.ok(Number.isInteger(summary.localRunCount) && summary.localRunCount >= 0);
  assert.ok(Number.isInteger(summary.localRunVisibleCount) && summary.localRunVisibleCount >= 0);
  assert.ok(summary.localRunDisplayLimit > 0, "스모크 로컬 실행 표시 한도가 올바르지 않습니다");
  assert.ok(summary.localRunVisibleCount <= summary.localRunDisplayLimit);
  assert.equal(summary.filteredLocalRunCount, summary.localRunVisibleCount);
  assert.match(summary.localRunCountsText || "", /전체 보관 \d+건/);
  assert.match(summary.localRunCountsText || "", /화면 최근 \d+\/\d+건/);
  assert.match(summary.localRunCountsText || "", /현재\s*조건 \d+건/);
  assert.equal(summary.snapshotCsvFound, summary.snapshotCount > 0);
  if (summary.snapshotCount >= 2) {
    assert.match(summary.comparisonText || "", /직전 .* 대비.*실패율.*평균.*runner분/);
    assert.equal(summary.comparisonPending, false);
  } else if (summary.snapshotCount === 1) {
    assert.equal(summary.comparisonPending, true, "스모크 통계 변화량 대기 문구가 없습니다");
  }
  assert.equal(summary.localCsvFound, summary.localRunVisibleCount > 0);
  if (summary.localRunVisibleCount > 0) {
    assert.equal(summary.localFiltersFound, true, "스모크 로컬 실행 필터가 없습니다");
    assert.ok(summary.localRunLinkCount > 0, "스모크 로컬 실행 링크가 없습니다");
    assert.equal(summary.localRunLinksValid, true, "스모크 로컬 실행 링크가 올바르지 않습니다");
    assert.match(summary.localDurationText || "", /최근 실행 #\d+/);
    if (summary.localSlowestCount > 0) {
      assert.equal(summary.localSlowestValid, true, "느린 로컬 실행 링크가 올바르지 않습니다");
    }
  }
}

export async function captureSmokeCsv(cdp, testId) {
  const result = await evaluate(cdp, `(async () => {
    const button = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!button) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:smoke-history'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      if (!blob) return null;
      return {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3)),
        filename,
        text: await blob.text(),
        type: blob.type,
      };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(result, `스모크 ${testId} 내보내기를 캡처하지 못했습니다`);
  assert.equal(result.type, "text/csv;charset=utf-8");
  return result;
}

export async function checkSmokeLocalRunFilters(cdp, timeoutMs) {
  const selected = await evaluate(cdp, `(async () => {
    const history = document.querySelector('[data-testid="smoke-statistics-history"]');
    const status = history?.querySelector('select[aria-label="로컬 스모크 실행 결과 필터"]');
    const admin = history?.querySelector('select[aria-label="로컬 스모크 관리자 포함 필터"]');
    if (!history || !status || !admin) return null;
    const settle = () => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const statusOption = Array.from(status.options).find(
      (item) => item.value !== 'all' && Number(item.getAttribute('data-count')) > 0
    );
    if (!statusOption) return null;
    status.value = statusOption.value;
    status.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const firstRow = history.querySelector('[data-testid="smoke-local-run-link"]')?.closest('li');
    const adminValue = firstRow?.textContent?.includes('관리자 포함') ? 'admin' : 'viewer';
    admin.value = adminValue;
    admin.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    let copiedUrl = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { copiedUrl = value; } },
    });
    history.querySelector('[data-testid="smoke-local-filter-copy"]')?.click();
    await settle();
    const filteredCount = Number(history.getAttribute('data-filtered-local-run-count'));
    const copied = copiedUrl ? new URL(copiedUrl) : null;
    const params = new URLSearchParams(location.search);
    return {
      admin: adminValue,
      copiedAdmin: copied?.searchParams.get('smoke_local_admin'),
      copiedStatus: copied?.searchParams.get('smoke_local_status'),
      copyStatus: history.getAttribute('data-local-run-copy-status'),
      exportCount: Number(
        history.querySelector('[data-testid="smoke-local-runs-csv"]')?.getAttribute('data-export-count')
      ),
      filteredCount,
      linkCount: history.querySelectorAll('[data-testid="smoke-local-run-link"]').length,
      status: statusOption.value,
      urlAdmin: params.get('smoke_local_admin'),
      urlStatus: params.get('smoke_local_status'),
    };
  })()`);
  assert.ok(selected, "스모크 로컬 실행 필터를 찾지 못했습니다");
  assert.ok(selected.filteredCount > 0, "스모크 로컬 실행 필터 결과가 없습니다");
  assert.equal(selected.linkCount, selected.filteredCount, "스모크 필터 링크 건수가 다릅니다");
  assert.equal(selected.exportCount, selected.filteredCount, "스모크 필터 CSV 건수가 다릅니다");
  assert.equal(selected.urlStatus, selected.status, "스모크 결과 필터가 URL에 없습니다");
  assert.equal(selected.urlAdmin, selected.admin, "스모크 관리자 필터가 URL에 없습니다");
  assert.equal(selected.copiedStatus, selected.status, "복사된 스모크 결과 필터가 다릅니다");
  assert.equal(selected.copiedAdmin, selected.admin, "복사된 스모크 관리자 필터가 다릅니다");
  assert.equal(selected.copyStatus, "copied", "스모크 필터 링크 복사 완료 표시가 없습니다");

  await reloadPage(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `(() => {
      const history = document.querySelector('[data-testid="smoke-statistics-history"]');
      return history?.getAttribute('data-local-run-status-filter') === ${JSON.stringify(selected.status)} &&
        history?.getAttribute('data-local-run-admin-filter') === ${JSON.stringify(selected.admin)} &&
        Number(history?.getAttribute('data-filtered-local-run-count')) === ${selected.filteredCount};
    })()`,
    timeoutMs,
    "스모크 로컬 실행 필터가 새로고침 후 복원되지 않았습니다",
  );
  const restored = await evaluate(cdp, `(async () => {
    const history = document.querySelector('[data-testid="smoke-statistics-history"]');
    const status = history?.querySelector('select[aria-label="로컬 스모크 실행 결과 필터"]');
    const admin = history?.querySelector('select[aria-label="로컬 스모크 관리자 포함 필터"]');
    if (!history || !status || !admin) return null;
    const before = {
      admin: admin.value,
      copyStatus: history.getAttribute('data-local-run-copy-status'),
      status: status.value,
    };
    status.value = 'all';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    admin.value = 'all';
    admin.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const params = new URLSearchParams(location.search);
    return {
      ...before,
      filteredCount: Number(history.getAttribute('data-filtered-local-run-count')),
      urlCleared: !params.has('smoke_local_status') && !params.has('smoke_local_admin'),
      visibleCount: Number(history.getAttribute('data-local-run-visible-count')),
    };
  })()`);
  assert.ok(restored, "복원된 스모크 로컬 실행 필터를 찾지 못했습니다");
  assert.equal(restored.status, selected.status, "스모크 결과 필터 선택값이 복원되지 않았습니다");
  assert.equal(restored.admin, selected.admin, "스모크 관리자 필터 선택값이 복원되지 않았습니다");
  assert.equal(restored.copyStatus, "idle", "새로고침 후 복사 상태가 초기화되지 않았습니다");
  assert.equal(restored.urlCleared, true, "스모크 로컬 실행 기본 필터가 URL에서 제거되지 않았습니다");
  assert.equal(restored.filteredCount, restored.visibleCount, "스모크 로컬 실행 필터가 전체로 복원되지 않았습니다");
}

export function runSmokeStatisticsHistoryAssertionsSelfTest() {
  assertSmokeStatisticsHistory({
    comparisonPending: false,
    comparisonText: "직전 2026-08-01 대비 · 실패율 +2%p · 평균 -3초 · +1 runner분",
    filteredLocalRunCount: 1,
    historyFound: true,
    historyOpen: true,
    localCsvFound: true,
    localDurationText: "최근 실행 #123 · 1분 · 직전 대비 +2초",
    localFiltersFound: true,
    localRunCount: 1,
    localRunCountsText: "전체 보관 1건 · 화면 최근 1/20건 · 현재 조건 1건",
    localRunDisplayLimit: 20,
    localRunLinkCount: 1,
    localRunLinksValid: true,
    localRunVisibleCount: 1,
    localSlowestCount: 1,
    localSlowestValid: true,
    snapshotCount: 2,
    snapshotCsvFound: true,
    snapshotText: "GitHub API를 추가 호출하지 않고 대시보드를 열지 않아도 직접 기록 새 콜백 저장 시 지난 기록을 자동 정리",
  });
  assertSmokeStatisticsHistory({
    comparisonPending: true,
    comparisonText: null,
    filteredLocalRunCount: 0,
    historyFound: true,
    historyOpen: true,
    localCsvFound: false,
    localDurationText: null,
    localFiltersFound: false,
    localRunCount: 0,
    localRunCountsText: "전체 보관 0건 · 화면 최근 0/20건 · 현재 조건 0건",
    localRunDisplayLimit: 20,
    localRunLinkCount: 0,
    localRunLinksValid: true,
    localRunVisibleCount: 0,
    localSlowestCount: 0,
    localSlowestValid: true,
    snapshotCount: 1,
    snapshotCsvFound: true,
    snapshotText: "GitHub API를 추가 호출하지 않고 대시보드를 열지 않아도 직접 기록 새 콜백 저장 시 지난 기록을 자동 정리",
  });
}

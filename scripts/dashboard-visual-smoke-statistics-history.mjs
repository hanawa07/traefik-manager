import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

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

export async function checkSmokeLocalRunFilters(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const history = document.querySelector('[data-testid="smoke-statistics-history"]');
    const status = history?.querySelector('select[aria-label="로컬 스모크 실행 결과 필터"]');
    const admin = history?.querySelector('select[aria-label="로컬 스모크 관리자 포함 필터"]');
    if (!history || !status || !admin) return null;
    const settle = () => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const selectNonEmpty = async (select, attribute) => {
      const option = Array.from(select.options).find(
        (item) => item.value !== 'all' && Number(item.getAttribute('data-count')) > 0
      );
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      const expected = Number(option.getAttribute('data-count'));
      const actual = Number(history.getAttribute('data-filtered-local-run-count'));
      const links = history.querySelectorAll('[data-testid="smoke-local-run-link"]').length;
      const exportCount = Number(
        history.querySelector('[data-testid="smoke-local-runs-csv"]')?.getAttribute('data-export-count')
      );
      const valid = history.getAttribute(attribute) === option.value &&
        actual === expected && links === expected && exportCount === expected;
      select.value = 'all';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      return valid;
    };
    const statusValid = await selectNonEmpty(status, 'data-local-run-status-filter');
    const adminValid = await selectNonEmpty(admin, 'data-local-run-admin-filter');
    return {
      adminValid,
      restored: history.getAttribute('data-local-run-status-filter') === 'all' &&
        history.getAttribute('data-local-run-admin-filter') === 'all' &&
        Number(history.getAttribute('data-filtered-local-run-count')) ===
          Number(history.getAttribute('data-local-run-visible-count')),
      statusValid,
    };
  })()`);
  assert.ok(result, "스모크 로컬 실행 필터를 찾지 못했습니다");
  assert.equal(result.statusValid, true, "스모크 로컬 실행 결과 필터가 올바르지 않습니다");
  assert.equal(result.adminValid, true, "스모크 관리자 포함 필터가 올바르지 않습니다");
  assert.equal(result.restored, true, "스모크 로컬 실행 필터가 전체로 복원되지 않았습니다");
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

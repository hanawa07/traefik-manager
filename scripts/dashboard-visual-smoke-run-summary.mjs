import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";
import {
  assertSmokeStatisticsHistory,
  captureSmokeCsv,
  checkSmokeLocalRunFilters,
} from "./dashboard-visual-smoke-statistics-history.mjs";

export async function checkSmokeRunSummary({ cdp, timeoutMs }) {
  const statusSummary = await evaluate(cdp, `(() => {
    const history = document.querySelector('[data-testid="smoke-statistics-history"]');
    if (history && !history.open) history.querySelector('summary')?.click();
    const durationTrend = document.querySelector('[data-testid="smoke-duration-trend"]');
    const revisionStatus = document.querySelector('[data-testid="smoke-deployment-revision-status"]');
    const localRunLinks = Array.from(
      history?.querySelectorAll('[data-testid="smoke-local-run-link"]') || []
    );
    return {
      basis: document.querySelector('[data-testid="smoke-failure-rate-basis"]')?.textContent,
      comparisonPending: Boolean(
        history?.querySelector('[data-testid="smoke-statistics-comparison-pending"]')
      ),
      comparisonText: history?.querySelector('[data-testid="smoke-statistics-comparison"]')?.textContent,
      counts: document.querySelector('[data-testid="smoke-run-status-counts"]')?.textContent,
      details: document.querySelector('[data-testid="smoke-actions-usage-details"]')?.textContent,
      durationTrendDelay: durationTrend?.getAttribute('data-smoke-duration-delay'),
      durationTrendFound: Boolean(durationTrend),
      durationTrendLatestValid: (() => {
        const link = durationTrend?.querySelector('[data-testid="smoke-duration-latest-run"]');
        return !link || (link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/'));
      })(),
      durationTrendText: durationTrend?.textContent,
      filteredLocalRunCount: Number(history?.getAttribute('data-filtered-local-run-count') || 0),
      historyFound: Boolean(history),
      historyOpen: history?.open,
      localCsvFound: Boolean(history?.querySelector('[data-testid="smoke-local-runs-csv"]')),
      localDurationText: history?.querySelector('[data-testid="smoke-local-duration-comparison"]')?.textContent,
      localFiltersFound: Boolean(history?.querySelector('[data-testid="smoke-local-run-filters"]')),
      localRunCount: Number(history?.getAttribute('data-local-run-count') || 0),
      localRunCountsText: history?.querySelector('[data-testid="smoke-local-run-counts"]')?.textContent,
      localRunDisplayLimit: Number(history?.getAttribute('data-local-run-display-limit') || 0),
      localRunLinkCount: localRunLinks.length,
      localRunLinksValid: localRunLinks.every((link) =>
        link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/')
      ),
      localRunVisibleCount: Number(history?.getAttribute('data-local-run-visible-count') || 0),
      localSlowestCount: history?.querySelectorAll('[data-testid="smoke-local-slowest-run"]').length || 0,
      localSlowestValid: Array.from(
        history?.querySelectorAll('[data-testid="smoke-local-slowest-run"]') || []
      ).every((link) =>
        link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/')
      ),
      revisionFound: Boolean(revisionStatus),
      revisionLinkValid: (() => {
        const link = revisionStatus?.querySelector('a');
        return Boolean(link?.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/'));
      })(),
      revisionStatus: revisionStatus?.getAttribute('data-smoke-revision-status'),
      revisionText: revisionStatus?.textContent,
      revisionsValid: [
        revisionStatus?.getAttribute('data-deployed-revision'),
        revisionStatus?.getAttribute('data-smoke-revision'),
      ].every((value) => /^[0-9a-f]{7,40}$/.test(value || '')),
      slowestCount: document.querySelectorAll('[data-testid="smoke-slowest-runs"] a').length,
      slowestValid: Array.from(document.querySelectorAll('[data-testid="smoke-slowest-runs"] a'))
        .every((link) => link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/')),
      snapshotCsvFound: Boolean(history?.querySelector('[data-testid="smoke-statistics-csv"]')),
      snapshotCount: Number(history?.getAttribute('data-snapshot-count') || 0),
      snapshotText: history?.textContent,
      usage: document.querySelector('[data-testid="smoke-actions-usage"]')?.textContent,
      usageNote: document.querySelector('[data-testid="smoke-actions-usage-note"]')?.textContent,
    };
  })()`);
  assert.match(statusSummary.counts || "", /30일 전체 \d+건/);
  assert.match(statusSummary.counts || "", /성공 \d+ · 실패 \d+ · 취소 \d+ · 건너뜀 \d+/);
  assert.match(statusSummary.basis || "", /workflow 성공\+실패.*취소·전체 건너뜀 제외/);
  assert.match(statusSummary.usage || "", /Actions 실행시간.*예상 사용량/);
  assert.equal(statusSummary.revisionFound, true, "배포와 운영 스모크 커밋 비교가 없습니다");
  assert.ok(["pending", "match", "mismatch"].includes(statusSummary.revisionStatus));
  if (statusSummary.revisionStatus === "pending") {
    assert.match(statusSummary.revisionText || "", /운영 스모크 커밋 확인 대기/);
  } else {
    assert.match(statusSummary.revisionText || "", /운영 스모크 커밋 (일치|불일치).*배포.*최근 성공/s);
    assert.equal(statusSummary.revisionsValid, true, "배포 또는 스모크 커밋 형식이 올바르지 않습니다");
    assert.equal(statusSummary.revisionLinkValid, true, "최근 성공 스모크 실행 링크가 올바르지 않습니다");
  }
  const durationRunCount = Number(
    statusSummary.usage?.match(/Actions 실행시간 (\d+)\//)?.[1] || 0,
  );
  if (!statusSummary.usage?.includes("집계 없음")) {
    assert.match(statusSummary.usage, /예상 사용량.*runner분/);
    assert.match(statusSummary.details || "", /jobs API/);
    assert.match(statusSummary.details || "", /workflow 결론/);
    if (durationRunCount) {
      assert.ok(statusSummary.slowestCount > 0, "느린 Actions 실행 상세 링크가 없습니다");
      assert.equal(statusSummary.slowestValid, true, "느린 실행 링크가 GitHub Actions 주소가 아닙니다");
    }
  }
  if (durationRunCount && statusSummary.localRunVisibleCount > 0) {
    assert.equal(statusSummary.durationTrendFound, true, "7일·30일 실행시간 추이가 없습니다");
    assert.match(statusSummary.durationTrendText || "", /실행시간 평균.*7일.*30일/s);
    assert.ok(["normal", "delayed"].includes(statusSummary.durationTrendDelay));
    assert.equal(statusSummary.durationTrendLatestValid, true, "최근 실행시간 링크가 올바르지 않습니다");
  }
  assert.match(statusSummary.usageNote || "", /GitHub 과금값 아님/);
  assertSmokeStatisticsHistory(statusSummary);
  if (statusSummary.snapshotCount > 0) {
    const csv = await captureSmokeCsv(cdp, "smoke-statistics-csv");
    assert.deepEqual(csv.bytes, [239, 187, 191], "스모크 통계 CSV UTF-8 BOM이 없습니다");
    assert.match(csv.filename, /^traefik-manager-smoke-statistics-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.match(csv.text, /^"captured_on","window_days"/);
  }
  if (statusSummary.localRunCount > 0) {
    const csv = await captureSmokeCsv(cdp, "smoke-local-runs-csv");
    assert.deepEqual(csv.bytes, [239, 187, 191], "스모크 로컬 이력 CSV UTF-8 BOM이 없습니다");
    assert.match(csv.filename, /^traefik-manager-smoke-local-runs-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.match(csv.text, /^"run_id","status","started_at"/);
    assert.match(csv.text, /"run_url".*\/actions\/runs\//s);
    await checkSmokeLocalRunFilters(cdp, timeoutMs);
  }
}

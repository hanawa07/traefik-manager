import assert from "node:assert/strict";

import { checkSmokeFailureArtifactFilters } from "./dashboard-visual-smoke-artifact-filters.mjs";
import { checkSmokeRunSummary } from "./dashboard-visual-smoke-run-summary.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeRunTrendRange({ cdp, timeoutMs }) {
  const initial = await evaluate(cdp, `(() => {
    const trend = document.querySelector('[data-testid="smoke-run-trend"]');
    const buttons = Array.from(trend?.querySelectorAll('button') || []);
    const seven = buttons.find((button) => button.textContent?.trim() === '7일');
    const thirty = buttons.find((button) => button.textContent?.trim() === '30일');
    thirty?.click();
    return {
      access: trend?.getAttribute('data-smoke-history-access'),
      revisionStatus: document.querySelector('[data-testid="smoke-deployment-revision-status"]')
        ?.getAttribute('data-smoke-revision-status'),
      revisionText: document.querySelector('[data-testid="smoke-deployment-revision-status"]')
        ?.textContent,
      sevenPressed: seven?.getAttribute('aria-pressed'),
      text: trend?.textContent,
      thirtyFound: Boolean(thirty),
    };
  })()`);
  if (initial.access === "restricted") {
    assert.match(initial.text || "", /GitHub 실행 통계와 로컬 콜백 이력은 관리자 계정에서 확인/);
    assert.equal(initial.revisionStatus, "restricted");
    assert.match(initial.revisionText || "", /운영 스모크 커밋.*관리자 계정에서 확인/s);
    return;
  }
  assert.equal(initial.sevenPressed, "true", "운영 점검 추이의 기본 7일 범위가 선택되지 않았습니다");
  assert.equal(initial.thirtyFound, true, "운영 점검 추이의 30일 범위를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('[data-testid="smoke-run-trend"] button'));
      const seven = buttons.find((button) => button.textContent?.trim() === '7일');
      const thirty = buttons.find((button) => button.textContent?.trim() === '30일');
      return seven?.getAttribute('aria-pressed') === 'false' &&
        thirty?.getAttribute('aria-pressed') === 'true';
    })()`,
    timeoutMs,
    "운영 점검 추이가 30일 범위로 전환되지 않았습니다",
  );
  const refreshedClock = await evaluate(cdp, `(async () => {
    const trend = document.querySelector('[data-testid="smoke-run-trend"]');
    const before = Number(trend?.getAttribute('data-artifact-reference-time'));
    const expected = before + 60_000;
    const originalNow = Date.now;
    try {
      Date.now = () => expected;
      window.dispatchEvent(new Event('focus'));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        after: Number(trend?.getAttribute('data-artifact-reference-time')),
        before,
        expected,
      };
    } finally {
      Date.now = originalNow;
    }
  })()`);
  assert.ok(Number.isFinite(refreshedClock.before), "Artifact 기준 시각이 없습니다");
  assert.equal(
    refreshedClock.after,
    refreshedClock.expected,
    "Artifact 기준 시각이 화면 복귀 시 갱신되지 않았습니다",
  );
  await checkSmokeRunSummary({ cdp, timeoutMs });
  await checkSmokeFailureArtifactFilters({ cdp, timeoutMs });
}

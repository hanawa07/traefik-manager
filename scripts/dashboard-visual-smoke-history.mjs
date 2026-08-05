import {
  ARTIFACT_URL,
  buildSmokeHistoryFixtures,
  COMMIT_URL,
  EXPIRED_ARTIFACT_URL,
  HIDDEN_UNCLASSIFIED_RUN_URL,
  RUN_URL,
  UNCLASSIFIED_RUN_URL,
  fulfillJsonRequest,
} from "./dashboard-visual-smoke-history-fixture.mjs";
import { checkSmokeHistoryFilters } from "./dashboard-visual-smoke-history-filters.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeRecentRunArtifact({ cdp, timeoutMs }) {
  const fixtures = await buildSmokeHistoryFixtures(cdp);
  const { fixture } = fixtures;

  await cdp.send("Fetch.enable", {
    patterns: [{
      requestStage: "Request",
      urlPattern: "*/api/v1/settings/smoke-rotation*",
    }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        if (history instanceof HTMLDetailsElement) history.open = true;
        const artifact = history?.querySelector('[data-testid="smoke-recent-run-artifact-link"]');
        const expiredArtifact = history?.querySelector('[data-testid="smoke-recent-run-artifact-expired"]');
        const latestExpiredArtifact = document.querySelector('[data-testid="smoke-latest-failure-artifact-expired"]');
        const expiringArtifact = history?.querySelector('[data-expiry-state="expiring_soon"]');
        const exclusionNote = document.querySelector('[data-testid="smoke-test-run-exclusion-note"]');
        const filterCount = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
        const metadata = history?.querySelector('[data-testid="smoke-failure-metadata-preview"]');
        if (metadata instanceof HTMLDetailsElement) metadata.open = true;
        const checkName = metadata?.querySelector('[data-testid="smoke-failure-check-name"]');
        const failureType = metadata?.querySelector('[data-testid="smoke-failure-type"]');
        const latestMetadata = document.querySelector('[data-testid="smoke-latest-failure-metadata-preview"]');
        if (latestMetadata instanceof HTMLDetailsElement) latestMetadata.open = true;
        const latestCommit = document.querySelector('[data-testid="smoke-latest-failure-commit-link"]');
        const rateLimit = document.querySelector('[data-testid="smoke-github-rate-limit"]');
        const rateLimitWarning = document.querySelector('[data-testid="smoke-github-rate-limit-warning"]');
        const refreshButton = document.querySelector('[data-testid="smoke-history-refresh"]');
        const retention = history?.querySelector('[data-testid="smoke-failure-metadata-retention"]');
        const typeSummary = history?.querySelector('[data-testid="smoke-failure-type-summary"]');
        const typeCounts = history?.querySelector('[data-testid="smoke-failure-type-period-counts"]');
        const typeTrend = history?.querySelector('[data-testid="smoke-failure-type-trend"]');
        const typeAlert = history?.querySelector('[data-testid="smoke-failure-type-increase-alert"]');
        const cancellationReason = history?.querySelector('[data-testid="smoke-cancellation-reason"]');
        const run = history?.querySelector('a[href="${RUN_URL}"]');
        const commit = history?.querySelector('[data-testid="smoke-recent-run-commit-link"]');
        return history?.open && artifact?.href === ${JSON.stringify(ARTIFACT_URL)} &&
          artifact.textContent?.includes('실패 화면') && run?.textContent?.includes('#987') &&
          commit?.href === ${JSON.stringify(COMMIT_URL)} && commit.textContent?.includes('abcdef0') &&
          expiringArtifact?.textContent?.includes('만료 임박') &&
          expiredArtifact?.getAttribute('aria-disabled') === 'true' &&
          expiredArtifact.textContent?.includes('화면 만료') &&
          latestExpiredArtifact?.getAttribute('aria-disabled') === 'true' &&
          !history?.querySelector('a[href="${EXPIRED_ARTIFACT_URL}"]') &&
          filterCount?.textContent?.includes('5/8건') &&
          metadata?.textContent?.includes('/dashboard/settings') &&
          checkName?.textContent?.includes('설정 화면 검사 실패') &&
          failureType?.textContent?.includes('화면 회귀') &&
          latestMetadata?.textContent?.includes('만료된 실패 화면 검사') &&
          latestCommit?.href === ${JSON.stringify(COMMIT_URL)} &&
          cancellationReason?.textContent?.includes('새 실행으로 대체') &&
          rateLimit?.textContent?.includes('GitHub API 10/60회 남음') &&
          rateLimit?.textContent?.includes('초기화') &&
          rateLimitWarning?.textContent?.includes('수동 새로고침과 자동 결과 확인을 잠갔습니다') &&
          (!refreshButton || (refreshButton instanceof HTMLButtonElement && refreshButton.disabled)) &&
          retention?.textContent?.includes('실패 정보 1/20건 보관') &&
          typeSummary?.getAttribute('data-window-days') === '30' &&
          typeCounts?.textContent?.includes('분류 2/4건') &&
          typeSummary?.textContent?.includes('로그인 1') &&
          typeSummary?.textContent?.includes('화면 회귀 1') &&
          typeSummary?.textContent?.includes('미분류 2') &&
          typeAlert?.textContent?.includes('미분류 · 최근 7일 2건') &&
          typeTrend?.querySelectorAll('li').length === 4 &&
          exclusionNote?.textContent?.includes('전체 통계는 GitHub workflow 결론 기준');
      })()`,
      timeoutMs,
      "최근 운영 점검 이력 또는 GitHub API 잔여량 보호 상태가 표시되지 않았습니다",
    );
    const unclassifiedClicked = await evaluate(cdp, `(() => {
      const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
      const button = history?.querySelector('[data-testid="smoke-failure-type-filter-unclassified"]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (!unclassifiedClicked) throw new Error("미분류 전체 기간 필터를 누르지 못했습니다");
    await waitForCondition(
      cdp,
      `(() => {
        const panel = document.querySelector(
          '[data-testid="smoke-recent-run-history"] [data-testid="smoke-failure-type-filtered-runs"]'
        );
        const links = panel?.querySelectorAll('a[data-failure-type="unclassified"]');
        const classifications = panel?.querySelectorAll('[data-testid="smoke-failure-classification"]');
        return panel?.textContent?.includes('선택 조건 실행 2건') && links?.length === 2 &&
          classifications?.length === 2 && location.search.includes('smoke_trend_type=unclassified') &&
          Array.from(links).some((link) => link.href === ${JSON.stringify(UNCLASSIFIED_RUN_URL)}) &&
          Array.from(links).some((link) => link.href === ${JSON.stringify(HIDDEN_UNCLASSIFIED_RUN_URL)});
      })()`,
      timeoutMs,
      "미분류 실패 실행 링크가 표시되지 않았습니다",
    );
    const dateClicked = await evaluate(cdp, `(() => {
      const buttons = Array.from(document.querySelectorAll(
        '[data-testid="smoke-recent-run-history"] [data-testid="smoke-failure-date-filter"]'
      ));
      const button = buttons.find((item) => item.getAttribute('title')?.startsWith('2026-07-18'));
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`);
    if (!dateClicked) throw new Error("실패 발생일 필터를 누르지 못했습니다");
    await waitForCondition(
      cdp,
      `(() => {
        const panel = document.querySelector(
          '[data-testid="smoke-recent-run-history"] [data-testid="smoke-failure-type-filtered-runs"]'
        );
        const links = panel?.querySelectorAll('a');
        return panel?.textContent?.includes('선택 조건 실행 1건') && links?.length === 1 &&
          links[0].href === ${JSON.stringify(UNCLASSIFIED_RUN_URL)} &&
          location.search.includes('smoke_trend_type=unclassified') &&
          location.search.includes('smoke_trend_date=2026-07-18');
      })()`,
      timeoutMs,
      "실패 유형·날짜 교차 필터가 적용되지 않았습니다",
    );
    const trendReloadRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const trendReloaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    await fulfillJsonRequest(cdp, await trendReloadRequest, fixture);
    await trendReloaded;
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        if (history instanceof HTMLDetailsElement) history.open = true;
        const type = history?.querySelector('[data-testid="smoke-failure-type-filter-unclassified"]');
        const dates = Array.from(history?.querySelectorAll('[data-testid="smoke-failure-date-filter"]') ?? []);
        const date = dates.find((item) => item.getAttribute('title')?.startsWith('2026-07-18'));
        const panel = history?.querySelector('[data-testid="smoke-failure-type-filtered-runs"]');
        return type?.getAttribute('aria-pressed') === 'true' &&
          date?.getAttribute('aria-pressed') === 'true' &&
          panel?.textContent?.includes('선택 조건 실행 1건');
      })()`,
      timeoutMs,
      "실패 유형·날짜 필터가 새로고침 후 복원되지 않았습니다",
    );
    await evaluate(cdp, `document.querySelector(
      '[data-testid="smoke-recent-run-history"] [data-testid="smoke-failure-type-filtered-runs"] button'
    )?.click()`);
    await waitForCondition(
      cdp,
      `!document.querySelector(
        '[data-testid="smoke-recent-run-history"] [data-testid="smoke-failure-type-filtered-runs"]'
      ) && !location.search.includes('smoke_trend_type') &&
        !location.search.includes('smoke_trend_date')`,
      timeoutMs,
      "실패 유형·날짜 필터가 초기화되지 않았습니다",
    );
    await checkSmokeHistoryFilters({
      cdp,
      fixtures,
      timeoutMs,
    });
  } finally {
    await cdp.send("Fetch.disable");
  }
}

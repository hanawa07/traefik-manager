import {
  ARTIFACT_URL,
  buildSmokeHistoryFixtures,
  COMMIT_URL,
  EXPIRED_ARTIFACT_URL,
  RUN_URL,
} from "./dashboard-visual-smoke-history-fixture.mjs";
import { checkSmokeHistoryFilters } from "./dashboard-visual-smoke-history-filters.mjs";
import { waitForCondition } from "./dashboard-visual-runtime.mjs";

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
        const latestMetadata = document.querySelector('[data-testid="smoke-latest-failure-metadata-preview"]');
        if (latestMetadata instanceof HTMLDetailsElement) latestMetadata.open = true;
        const latestCommit = document.querySelector('[data-testid="smoke-latest-failure-commit-link"]');
        const rateLimit = document.querySelector('[data-testid="smoke-github-rate-limit"]');
        const rateLimitWarning = document.querySelector('[data-testid="smoke-github-rate-limit-warning"]');
        const refreshButton = document.querySelector('[data-testid="smoke-history-refresh"]');
        const retention = history?.querySelector('[data-testid="smoke-failure-metadata-retention"]');
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
          filterCount?.textContent?.includes('4/8건') &&
          metadata?.textContent?.includes('/dashboard/settings') &&
          checkName?.textContent?.includes('설정 화면 검사 실패') &&
          latestMetadata?.textContent?.includes('만료된 실패 화면 검사') &&
          latestCommit?.href === ${JSON.stringify(COMMIT_URL)} &&
          cancellationReason?.textContent?.includes('새 실행으로 대체') &&
          rateLimit?.textContent?.includes('GitHub API 10/60회 남음') &&
          rateLimit?.textContent?.includes('초기화') &&
          rateLimitWarning?.textContent?.includes('수동 새로고침과 자동 결과 확인을 잠갔습니다') &&
          (!refreshButton || (refreshButton instanceof HTMLButtonElement && refreshButton.disabled)) &&
          retention?.textContent?.includes('실패 정보 1/20건 보관') &&
          exclusionNote?.textContent?.includes('전체 통계는 GitHub workflow 결론 기준');
      })()`,
      timeoutMs,
      "최근 운영 점검 이력 또는 GitHub API 잔여량 보호 상태가 표시되지 않았습니다",
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

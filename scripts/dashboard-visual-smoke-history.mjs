import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/987";
const COMMIT_URL = "https://github.com/hanawa07/traefik-manager/commit/abcdef0";
const ARTIFACT_URL = `${RUN_URL}/artifacts/654`;
const EXPIRED_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/986";
const EXPIRED_ARTIFACT_URL = `${EXPIRED_RUN_URL}/artifacts/653`;
const SUCCESS_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/985";
const PAGE_TWO_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/984";

export async function checkSmokeRecentRunArtifact({ cdp, timeoutMs }) {
  const fixture = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/settings/smoke-rotation');
    if (!response.ok) return null;
    const status = await response.json();
    const failedRun = {
      run_id: 987,
      status: 'failure',
      completed_at: '2026-07-20T06:00:00Z',
      run_url: ${JSON.stringify(RUN_URL)},
      run_number: 987,
      commit_sha: 'abcdef0',
      summary: '실패 단계: 운영 로그인·화면 검사',
      notification_suppressed: false,
      artifact_url: ${JSON.stringify(ARTIFACT_URL)},
      artifact_expires_at: '2026-07-23T06:00:00Z',
      failure_metadata: {
        captured_at: '2026-07-20T06:00:01Z',
        check_name: '설정 화면 검사 실패',
        screen_path: '/dashboard/settings',
        page_title: 'Traefik Manager 설정',
      },
    };
    const expiredRun = {
      ...failedRun,
      run_id: 986,
      run_url: ${JSON.stringify(EXPIRED_RUN_URL)},
      run_number: 986,
      artifact_url: ${JSON.stringify(EXPIRED_ARTIFACT_URL)},
      artifact_expires_at: '2026-07-19T06:00:00Z',
      failure_metadata: {
        ...failedRun.failure_metadata,
        check_name: '만료된 실패 화면 검사',
      },
    };
    const successRun = {
      ...failedRun,
      run_id: 985,
      status: 'success',
      run_url: ${JSON.stringify(SUCCESS_RUN_URL)},
      run_number: 985,
      summary: '운영 로그인·화면 검사 성공',
      artifact_url: null,
      artifact_expires_at: null,
      failure_metadata: null,
    };
    return {
      ...status,
      monitoring_history_checked_at: '2026-07-21T06:00:00Z',
      monitoring_history_days: 30,
      monitoring_history_page: 1,
      monitoring_history_per_page: 5,
      monitoring_history_total: 8,
      monitoring_history_total_pages: 2,
      monitoring_history_search: '',
      monitoring_history_status: 'all',
      monitoring_failure_metadata_count: 1,
      monitoring_failure_metadata_limit: 20,
      monitoring_github_rate_limit_remaining: 10,
      monitoring_github_rate_limit_limit: 60,
      monitoring_github_rate_limit_reset_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      monitoring_latest_failure: expiredRun,
      monitoring_recent_runs: [failedRun, expiredRun, successRun],
    };
  })()`);
  assert.ok(fixture, "운영 점검 최근 이력 fixture의 기본 응답을 읽지 못했습니다");
  const successFixture = {
    ...fixture,
    monitoring_history_status: "success",
    monitoring_history_total: 1,
    monitoring_history_total_pages: 1,
    monitoring_recent_runs: [fixture.monitoring_recent_runs[2]],
  };
  const failureFixture = {
    ...fixture,
    monitoring_history_status: "failure",
    monitoring_history_total: 2,
    monitoring_history_total_pages: 1,
    monitoring_recent_runs: fixture.monitoring_recent_runs.slice(0, 2),
  };
  const searchFixture = {
    ...failureFixture,
    monitoring_history_search: "986",
    monitoring_history_total: 1,
    monitoring_recent_runs: [fixture.monitoring_recent_runs[1]],
  };
  const sevenDayFixture = {
    ...fixture,
    monitoring_history_days: 7,
    monitoring_history_total: 8,
    monitoring_history_total_pages: 2,
  };
  const pageTwoFixture = {
    ...sevenDayFixture,
    monitoring_history_page: 2,
    monitoring_recent_runs: [{
      ...fixture.monitoring_recent_runs[2],
      run_id: 984,
      run_number: 984,
      run_url: PAGE_TWO_RUN_URL,
    }],
  };

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
          filterCount?.textContent?.includes('3/8건') &&
          metadata?.textContent?.includes('/dashboard/settings') &&
          checkName?.textContent?.includes('설정 화면 검사 실패') &&
          latestMetadata?.textContent?.includes('만료된 실패 화면 검사') &&
          latestCommit?.href === ${JSON.stringify(COMMIT_URL)} &&
          rateLimit?.textContent?.includes('GitHub API 10/60회 남음') &&
          rateLimit?.textContent?.includes('초기화') &&
          rateLimitWarning?.textContent?.includes('수동 새로고침과 자동 결과 확인을 잠갔습니다') &&
          (!refreshButton || (refreshButton instanceof HTMLButtonElement && refreshButton.disabled)) &&
          retention?.textContent?.includes('실패 정보 1/20건 보관') &&
          exclusionNote?.textContent?.includes('[테스트] 실행은 최근 실행·실패율 집계에서 제외');
      })()`,
      timeoutMs,
      "최근 운영 점검 이력 또는 GitHub API 잔여량 보호 상태가 표시되지 않았습니다",
    );
    const successRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const statusChanged = await evaluate(cdp, `(() => {
      const select = document.querySelector('[data-testid="smoke-recent-run-status-filter"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!(select instanceof HTMLSelectElement) || !setter) return false;
      setter.call(select, 'success');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assert.equal(statusChanged, true, "최근 운영 점검 상태 필터를 변경하지 못했습니다");
    const successPaused = await successRequest;
    assert.match(successPaused.request.url, /history_status=success/);
    await fulfillJsonRequest(cdp, successPaused, successFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
        const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
        return items?.length === 1 && items[0].textContent?.includes('#985') &&
          count?.textContent?.includes('1/1건');
      })()`,
      timeoutMs,
      "최근 운영 점검 성공 상태 필터가 적용되지 않았습니다",
    );
    const failureRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const failureChanged = await evaluate(cdp, `(() => {
      const select = document.querySelector('[data-testid="smoke-recent-run-status-filter"]');
      const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!(select instanceof HTMLSelectElement) || !selectSetter) return false;
      selectSetter.call(select, 'failure');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assert.equal(failureChanged, true, "최근 운영 점검 실패 상태 필터를 변경하지 못했습니다");
    const failurePaused = await failureRequest;
    assert.match(failurePaused.request.url, /history_status=failure/);
    await fulfillJsonRequest(cdp, failurePaused, failureFixture);

    const searchChanged = await evaluate(cdp, `(() => {
      const input = document.querySelector('[data-testid="smoke-recent-run-search"]');
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!(input instanceof HTMLInputElement) || !inputSetter) return false;
      inputSetter.call(input, '986');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    assert.equal(searchChanged, true, "최근 운영 점검 검색어를 입력하지 못했습니다");
    const searchRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const searchSubmitted = await evaluate(cdp, `(() => {
      const input = document.querySelector('[data-testid="smoke-recent-run-search"]');
      const form = input?.closest('form');
      if (!(form instanceof HTMLFormElement)) return false;
      form.requestSubmit();
      return true;
    })()`);
    assert.equal(searchSubmitted, true, "최근 운영 점검 검색을 제출하지 못했습니다");
    const searchPaused = await searchRequest;
    assert.match(searchPaused.request.url, /history_search=986/);
    assert.match(searchPaused.request.url, /history_status=failure/);
    await fulfillJsonRequest(cdp, searchPaused, searchFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
        const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
        return items?.length === 1 && items[0].textContent?.includes('#986') &&
          count?.textContent?.includes('1/1건');
      })()`,
      timeoutMs,
      "최근 운영 점검 상태·검색 조합이 적용되지 않았습니다",
    );
    const filterUrl = await evaluate(cdp, "location.search");
    assert.match(filterUrl, /smoke_status=failure/);
    assert.match(filterUrl, /smoke_search=986/);

    const reloadRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const restoredFilterRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const reloaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    await fulfillJsonRequest(cdp, await reloadRequest, fixture);
    await reloaded;
    const restoredFilterPaused = await restoredFilterRequest;
    assert.match(restoredFilterPaused.request.url, /history_search=986/);
    assert.match(restoredFilterPaused.request.url, /history_status=failure/);
    await fulfillJsonRequest(cdp, restoredFilterPaused, searchFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        if (history instanceof HTMLDetailsElement) history.open = true;
        const status = history?.querySelector('[data-testid="smoke-recent-run-status-filter"]');
        const search = history?.querySelector('[data-testid="smoke-recent-run-search"]');
        const items = history?.querySelectorAll('[data-testid="smoke-recent-run-item"]');
        return status?.value === 'failure' && search?.value === '986' &&
          items?.length === 1 && items[0].textContent?.includes('#986');
      })()`,
      timeoutMs,
      "최근 운영 점검 필터가 새로고침 후 복원되지 않았습니다",
    );

    const filtersReset = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    assert.equal(filtersReset, true, "최근 운영 점검 필터 초기화 버튼을 누르지 못했습니다");
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        const status = history?.querySelector('[data-testid="smoke-recent-run-status-filter"]');
        const search = history?.querySelector('[data-testid="smoke-recent-run-search"]');
        const reset = history?.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
        const count = history?.querySelector('[data-testid="smoke-recent-run-filter-count"]');
        return status?.value === 'all' && search?.value === '' &&
          reset?.disabled === true && count?.textContent?.includes('3/8건') &&
          !location.search.includes('smoke_status') && !location.search.includes('smoke_search');
      })()`,
      timeoutMs,
      "최근 운영 점검 필터가 기본값으로 돌아오지 않았습니다",
    );

    const daysRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const daysChanged = await evaluate(cdp, `(() => {
      const select = document.querySelector('[data-testid="smoke-recent-run-days-filter"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!(select instanceof HTMLSelectElement) || !setter) return false;
      setter.call(select, '7');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assert.equal(daysChanged, true, "최근 운영 점검 조회 기간을 변경하지 못했습니다");
    const daysPaused = await daysRequest;
    assert.match(daysPaused.request.url, /history_days=7/);
    assert.match(daysPaused.request.url, /history_page=1/);
    await fulfillJsonRequest(cdp, daysPaused, sevenDayFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const page = document.querySelector('[data-testid="smoke-recent-run-page"]');
        const days = document.querySelector('[data-testid="smoke-recent-run-days-filter"]');
        return page?.textContent?.includes('1/2 페이지') && days?.value === '7';
      })()`,
      timeoutMs,
      "최근 운영 점검 7일 이력이 표시되지 않았습니다",
    );

    const pageRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const nextClicked = await evaluate(cdp, `(() => {
      const buttons = document.querySelectorAll('[data-testid="smoke-recent-run-pagination"] button');
      const next = buttons[buttons.length - 1];
      if (!(next instanceof HTMLButtonElement) || next.disabled) return false;
      next.click();
      return true;
    })()`);
    assert.equal(nextClicked, true, "최근 운영 점검 다음 페이지를 누르지 못했습니다");
    const pagePaused = await pageRequest;
    assert.match(pagePaused.request.url, /history_page=2/);
    await fulfillJsonRequest(cdp, pagePaused, pageTwoFixture);
    await waitForCondition(
      cdp,
      `(() => {
        const page = document.querySelector('[data-testid="smoke-recent-run-page"]');
        const run = document.querySelector('a[href="${PAGE_TWO_RUN_URL}"]');
        return page?.textContent?.includes('2/2 페이지') && run?.textContent?.includes('#984') &&
          location.search.includes('smoke_days=7') && location.search.includes('smoke_page=2');
      })()`,
      timeoutMs,
      "최근 운영 점검 페이지 이동이 적용되지 않았습니다",
    );

    const pageFiltersReset = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    assert.equal(pageFiltersReset, true, "최근 운영 점검 기간·페이지 필터를 초기화하지 못했습니다");
    await waitForCondition(
      cdp,
      `(() => {
        const history = document.querySelector('[data-testid="smoke-recent-run-history"]');
        const days = history?.querySelector('[data-testid="smoke-recent-run-days-filter"]');
        const page = history?.querySelector('[data-testid="smoke-recent-run-page"]');
        const reset = history?.querySelector('[data-testid="smoke-recent-run-reset-filters"]');
        return days?.value === '30' && page?.textContent?.includes('1/2 페이지') &&
          reset?.disabled === true && !location.search.includes('smoke_days') &&
          !location.search.includes('smoke_page');
      })()`,
      timeoutMs,
      "최근 운영 점검 기간·페이지가 기본값으로 돌아오지 않았습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }
}

async function fulfillJsonRequest(cdp, request, payload) {
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(payload)).toString("base64"),
  });
}

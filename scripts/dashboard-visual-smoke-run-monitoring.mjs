import assert from "node:assert/strict";

import { evaluate, reloadPage, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkSmokeRunTrendRange({ cdp, timeoutMs }) {
  const initial = await evaluate(cdp, `(() => {
    const trend = document.querySelector('[data-testid="smoke-run-trend"]');
    const buttons = Array.from(trend?.querySelectorAll('button') || []);
    const seven = buttons.find((button) => button.textContent?.trim() === '7일');
    const thirty = buttons.find((button) => button.textContent?.trim() === '30일');
    thirty?.click();
    return {
      sevenPressed: seven?.getAttribute('aria-pressed'),
      thirtyFound: Boolean(thirty),
    };
  })()`);
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
  const statusSummary = await evaluate(cdp, `(() => ({
    basis: document.querySelector('[data-testid="smoke-failure-rate-basis"]')?.textContent,
    counts: document.querySelector('[data-testid="smoke-run-status-counts"]')?.textContent,
    usage: document.querySelector('[data-testid="smoke-actions-usage"]')?.textContent,
    usageNote: document.querySelector('[data-testid="smoke-actions-usage-note"]')?.textContent,
  }))()`);
  assert.match(statusSummary.counts || "", /30일 전체 \d+건/);
  assert.match(statusSummary.counts || "", /성공 \d+ · 실패 \d+ · 취소 \d+ · 건너뜀 \d+/);
  assert.match(statusSummary.basis || "", /workflow 성공\+실패.*취소·전체 건너뜀 제외/);
  assert.match(statusSummary.usage || "", /Actions 실행시간.*예상 사용량/);
  if (!statusSummary.usage?.includes("집계 없음")) {
    assert.match(statusSummary.usage, /예상 사용량.*runner분/);
  }
  assert.match(statusSummary.usageNote || "", /GitHub 과금값 아님/);
  const failureLinks = await evaluate(cdp, `(() => {
    const alert = document.querySelector('[data-testid="smoke-failure-rate"][role="alert"]');
    const container = document.querySelector('[data-testid="smoke-failure-run-links"]');
    const links = Array.from(container?.querySelectorAll('a') || []);
    const artifactLinks = Array.from(
      container?.querySelectorAll('[data-testid="smoke-failure-artifact-link"]') || []
    );
    const artifactExpiry = Array.from(
      container?.querySelectorAll('[data-testid="smoke-artifact-expiry"]') || []
    );
    const expiredArtifacts = Array.from(
      container?.querySelectorAll('[data-testid="smoke-failure-artifact-expired"]') || []
    );
    const runItems = Array.from(
      container?.querySelectorAll('[data-testid="smoke-failure-run"]') || []
    );
    const orderValues = runItems.map((item) => {
      const state = item.getAttribute('data-artifact-state');
      const expiresAt = Date.parse(item.getAttribute('data-artifact-expires-at') || '');
      if (['active', 'expiring_soon'].includes(state) && Number.isFinite(expiresAt)) return expiresAt;
      if (state === 'available') return Number.MAX_SAFE_INTEGER - 2;
      if (state === 'expired') return Number.MAX_SAFE_INTEGER - 1;
      return Number.MAX_SAFE_INTEGER;
    });
    return {
      alert: Boolean(alert),
      artifactCount: artifactLinks.length,
      artifactExpiryCount: artifactExpiry.length,
      artifactExpiryValid: artifactExpiry.every((item) => {
        const state = item.getAttribute('data-expiry-state');
        const remaining = item.getAttribute('data-remaining-label');
        return ['active', 'expiring_soon', 'expired'].includes(state) &&
          item.textContent?.includes('·') && Boolean(item.title) &&
          (state === 'expired' ? !remaining : Boolean(remaining && item.textContent?.includes(remaining)));
      }),
      artifactValid: artifactLinks.every((link) =>
        link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/') &&
          link.href.includes('/artifacts/')
      ),
      artifactOrderValid: orderValues.every(
        (value, index) => index === 0 || orderValues[index - 1] <= value
      ),
      count: links.length,
      expiredArtifactCount: expiredArtifacts.length,
      expiredArtifactValid: expiredArtifacts.every((item) =>
        item.getAttribute('aria-disabled') === 'true' &&
          item.textContent?.trim() === '화면 만료' && !item.closest('a')
      ),
      expectedArtifactCount: Number(container?.getAttribute('data-artifact-count') || 0),
      expectedArtifactExpiryCount: Number(
        container?.getAttribute('data-artifact-expiry-count') || 0
      ),
      expectedExpiredArtifactCount: Number(
        container?.getAttribute('data-expired-artifact-count') || 0
      ),
      filterOptions: Array.from(
        container?.querySelectorAll('select[aria-label="실패 실행 Artifact 필터"] option') || []
      ).map((option) => option.value),
      filterCounts: Array.from(
        container?.querySelectorAll('select[aria-label="실패 실행 Artifact 필터"] option') || []
      ).map((option) => Number(option.getAttribute('data-count'))),
      filterLabels: Array.from(
        container?.querySelectorAll('select[aria-label="실패 실행 Artifact 필터"] option') || []
      ).map((option) => option.textContent?.trim()),
      filterValue: container?.getAttribute('data-artifact-filter'),
      valid: links.every((link) =>
        link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/')
      ),
    };
  })()`);
  if (failureLinks.alert) {
    assert.ok(failureLinks.count > 0, "실패율 경고에 실패 실행 링크가 표시되지 않았습니다");
    assert.equal(failureLinks.valid, true, "실패 실행 링크가 GitHub Actions 주소가 아닙니다");
    assert.equal(
      failureLinks.artifactCount,
      failureLinks.expectedArtifactCount,
      "실패 실행의 Artifact 링크 수가 일치하지 않습니다",
    );
    assert.equal(failureLinks.artifactValid, true, "실패 화면 Artifact 링크가 올바르지 않습니다");
    assert.equal(
      failureLinks.artifactExpiryCount,
      failureLinks.expectedArtifactExpiryCount,
      "Artifact 만료 표시 수가 일치하지 않습니다",
    );
    assert.equal(failureLinks.artifactExpiryValid, true, "Artifact 만료 상태가 올바르지 않습니다");
    assert.equal(
      failureLinks.expiredArtifactCount,
      failureLinks.expectedExpiredArtifactCount,
      "만료된 Artifact 비활성 표시 수가 일치하지 않습니다",
    );
    assert.equal(failureLinks.expiredArtifactValid, true, "만료된 Artifact에 링크가 남았습니다");
    assert.equal(failureLinks.artifactOrderValid, true, "Artifact가 만료 임박 순으로 정렬되지 않았습니다");
    assert.equal(failureLinks.filterValue, "all", "Artifact 기본 필터가 전체가 아닙니다");
    assert.deepEqual(
      failureLinks.filterOptions,
      ["all", "available", "expiring_soon", "expired"],
      "Artifact 필터 선택지가 다릅니다",
    );
    assert.equal(
      failureLinks.filterLabels.every(
        (label, index) => label?.includes(`(${failureLinks.filterCounts[index]})`)
      ),
      true,
      "Artifact 필터 건수가 라벨에 표시되지 않았습니다",
    );
    const filterResult = await evaluate(cdp, `(async () => {
      const select = document.querySelector('select[aria-label="실패 실행 Artifact 필터"]');
      if (!select) return null;
      const settle = () => new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      select.value = 'available';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      let copiedUrl = null;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (value) => { copiedUrl = value; } },
      });
      const copyButton = document.querySelector('[data-testid="smoke-artifact-filter-copy"]');
      copyButton?.click();
      await settle();
      const successfulCopyStatus = copyButton?.getAttribute('data-copy-status');
      const copySuccessDuration = Number(copyButton?.getAttribute('data-copy-success-duration-ms'));
      await new Promise((resolve) => setTimeout(resolve, copySuccessDuration + 100));
      const resetCopyStatus = copyButton?.getAttribute('data-copy-status');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('clipboard blocked'); } },
      });
      copyButton?.click();
      await settle();
      let fallback = document.querySelector('input[aria-label="Artifact 필터 공유 URL 직접 복사"]');
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (document.activeElement === fallback && fallback?.selectionStart === 0 &&
            fallback.selectionEnd === fallback.value.length) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
        fallback = document.querySelector('input[aria-label="Artifact 필터 공유 URL 직접 복사"]');
      }
      const container = document.querySelector('[data-testid="smoke-failure-run-links"]');
      const items = Array.from(container?.querySelectorAll('[data-testid="smoke-failure-run"]') || []);
      const filteredCount = Number(container?.getAttribute('data-filtered-run-count'));
      const expectedCount = Number(select.selectedOptions[0]?.getAttribute('data-count'));
      const result = {
        valid: container?.getAttribute('data-artifact-filter') === 'available' &&
          filteredCount === expectedCount && items.length === Math.min(filteredCount, 5) &&
          items.every((item) =>
            ['active', 'expiring_soon', 'available'].includes(
              item.getAttribute('data-artifact-state')
            )
        ),
        copiedFilter: copiedUrl ? new URL(copiedUrl).searchParams.get('artifact_filter') : null,
        copyFailureStatus: copyButton?.getAttribute('data-copy-status'),
        copyResetStatus: resetCopyStatus,
        copySuccessStatus: successfulCopyStatus,
        fallbackFilter: fallback?.value ? new URL(fallback.value).searchParams.get('artifact_filter') : null,
        fallbackSelected: document.activeElement === fallback &&
          fallback?.selectionStart === 0 && fallback.selectionEnd === fallback.value.length,
        urlFilter: new URL(window.location.href).searchParams.get('artifact_filter'),
      };
      localStorage.removeItem('traefik-manager:smoke-artifact-filter');
      return result;
    })()`);
    assert.equal(filterResult?.valid, true, "다운로드 가능 Artifact 필터 결과가 다릅니다");
    assert.equal(filterResult?.copiedFilter, "available", "복사된 Artifact 필터 URL이 다릅니다");
    assert.equal(filterResult?.copySuccessStatus, "copied", "Artifact 필터 링크 복사 성공 표시가 없습니다");
    assert.equal(filterResult?.copyResetStatus, "idle", "Artifact 필터 링크 복사 성공 표시가 초기화되지 않았습니다");
    assert.equal(filterResult?.copyFailureStatus, "error", "Artifact 필터 링크 복사 실패 표시가 없습니다");
    assert.equal(filterResult?.fallbackFilter, "available", "Artifact 필터 직접 복사 URL이 다릅니다");
    assert.equal(filterResult?.fallbackSelected, true, "Artifact 필터 직접 복사 URL이 전체 선택되지 않았습니다");
    assert.equal(filterResult?.urlFilter, "available", "Artifact 필터가 URL에 반영되지 않았습니다");
    await reloadPage(cdp, timeoutMs);
    await waitForCondition(
      cdp,
      `document.querySelector('[data-testid="smoke-failure-run-links"]')?.getAttribute('data-artifact-filter') === 'available'`,
      timeoutMs,
      "Artifact 필터가 새로고침 후 복원되지 않았습니다",
    );
    const persistedFilter = await evaluate(cdp, `(async () => {
      const container = document.querySelector('[data-testid="smoke-failure-run-links"]');
      const select = container?.querySelector('select[aria-label="실패 실행 Artifact 필터"]');
      const persisted = select?.value === 'available';
      if (!select) return { persisted, restored: false };
      select.value = 'all';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        persisted,
        restored: container?.getAttribute('data-artifact-filter') === 'all',
        stored: localStorage.getItem('traefik-manager:smoke-artifact-filter'),
        urlCleared: !new URL(window.location.href).searchParams.has('artifact_filter'),
      };
    })()`);
    assert.equal(persistedFilter.persisted, true, "Artifact URL 필터가 선택 상자에 복원되지 않았습니다");
    assert.equal(persistedFilter.restored, true, "Artifact 필터가 전체로 복구되지 않았습니다");
    assert.equal(persistedFilter.stored, "all", "Artifact URL 필터가 로컬 저장값에 동기화되지 않았습니다");
    assert.equal(persistedFilter.urlCleared, true, "Artifact 전체 필터가 URL에서 제거되지 않았습니다");
  }
}

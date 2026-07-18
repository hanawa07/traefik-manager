import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

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
    return {
      alert: Boolean(alert),
      artifactCount: artifactLinks.length,
      artifactExpiryCount: artifactExpiry.length,
      artifactExpiryValid: artifactExpiry.every((item) =>
        ['active', 'expiring_soon', 'expired'].includes(item.getAttribute('data-expiry-state')) &&
          item.textContent?.includes('·') && Boolean(item.title)
      ),
      artifactValid: artifactLinks.every((link) =>
        link.href.startsWith('https://github.com/') && link.href.includes('/actions/runs/') &&
          link.href.includes('/artifacts/')
      ),
      count: links.length,
      expectedArtifactCount: Number(container?.getAttribute('data-artifact-count') || 0),
      expectedArtifactExpiryCount: Number(
        container?.getAttribute('data-artifact-expiry-count') || 0
      ),
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
  }
}

export async function checkSettingsTestAuditLinks({ cdp }) {
  const result = await evaluate(cdp, `(() => {
    const histories = Array.from(
      document.querySelectorAll('[data-testid="settings-test-recent-history"]')
    );
    histories.forEach((history) => { history.open = true; });
    const links = Array.from(document.querySelectorAll('a[aria-label$="감사 상세"]'));
    const retryButtons = histories.flatMap((history) =>
      Array.from(history.querySelectorAll('button[data-retry-audit-id]'))
    );
    return {
      count: links.length,
      historyCount: histories.length,
      historyItemCounts: histories.map((history) => history.querySelectorAll('li').length),
      expectedRetryCount: histories.reduce((count, history) =>
        count + (history.getAttribute('data-retry-enabled') === 'true'
          ? history.querySelectorAll('li[data-event-success="false"]').length
          : 0), 0
      ),
      retryCount: retryButtons.length,
      retryValid: retryButtons.every((button) => {
        const auditId = button.getAttribute('data-retry-audit-id');
        const link = button.closest('li')?.querySelector('a[aria-label$="감사 상세"]');
        return Boolean(auditId) && Boolean(link) &&
          new URL(link.href).searchParams.get('q') === auditId && !button.disabled;
      }),
      valid: links.every((link) => {
        const url = new URL(link.href);
        const id = url.searchParams.get('q');
        return url.pathname === '/dashboard/audit' && Boolean(id) && url.searchParams.get('expand') === id;
      }),
    };
  })()`);
  if (!result.count) return false;
  assert.equal(result.valid, true, "설정 테스트 감사 상세 링크 조건이 올바르지 않습니다");
  assert.ok(result.historyCount > 0, "설정 테스트 최근 이력 펼침 목록이 표시되지 않았습니다");
  assert.equal(
    result.historyItemCounts.every((count) => count > 0 && count <= 5),
    true,
    "설정 테스트 최근 이력이 최대 5건으로 표시되지 않았습니다",
  );
  assert.equal(
    result.retryCount,
    result.expectedRetryCount,
    "설정 실패 이력 재시도 버튼 수가 일치하지 않습니다",
  );
  assert.equal(result.retryValid, true, "설정 실패 이력 재시도 감사 ID가 일치하지 않습니다");
  return true;
}

export async function checkSmokeRotationAuditDetail({ cdp, timeoutMs }) {
  const filterFound = await evaluate(cdp, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === 'Secret 회전 결과'
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(filterFound, true, "Secret 회전 결과 감사 필터를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('filter') === 'smoke_rotation_result' &&
      document.querySelector('[data-visual-surface]')?.getAttribute('aria-busy') === 'false'`,
    timeoutMs,
    "Secret 회전 감사 로그를 불러오지 못했습니다",
  );

  const failureFound = await evaluate(cdp, `(() => {
    const row = document.querySelector('tr[data-audit-event="smoke_rotation_failed"]');
    const button = Array.from(row?.querySelectorAll('button') || []).find(
      (item) => item.textContent?.trim() === '상세 보기'
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(failureFound, true, "실패한 Secret 회전 감사 로그를 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const text = document.querySelector('[data-testid="smoke-rotation-audit-detail"]')?.textContent || '';
      return text.includes('Secret 회전 상세') &&
        text.includes('회전 결과') &&
        text.includes('실패 단계');
    })()`,
    timeoutMs,
    "Secret 회전 실패 상세가 표시되지 않았습니다",
  );
}

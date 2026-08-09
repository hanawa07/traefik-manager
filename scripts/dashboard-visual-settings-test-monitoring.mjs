import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkSmokeRecentRunArtifact } from "./dashboard-visual-smoke-history.mjs";

export async function checkSmokeGithubReferenceDisclosure({ cdp, timeoutMs }) {
  const initial = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid="smoke-rotation-status-card"]');
    const disclosure = card?.querySelector('[data-testid="smoke-github-reference-history"]');
    const diagnostics = card?.querySelector('[data-testid="smoke-github-rate-limit-audit-summary"]');
    return {
      diagnosticsVisible: Boolean(diagnostics?.getClientRects().length),
      exists: disclosure instanceof HTMLDetailsElement,
      open: disclosure instanceof HTMLDetailsElement ? disclosure.open : null,
      summary: disclosure?.querySelector('summary')?.textContent,
      text: card?.innerText,
    };
  })()`);
  if (!initial.exists) {
    assert.match(initial.text || "", /실패율 경고 기준/);
    return false;
  }
  assert.equal(initial.open, false, "GitHub 참고 이력이 기본으로 접혀 있지 않습니다");
  assert.equal(initial.diagnosticsVisible, false, "접힌 GitHub 진단이 화면에 노출됐습니다");
  assert.match(initial.summary || "", /전환 전 GitHub 실행 이력.*운영 판정 제외/s);
  assert.doesNotMatch(initial.text || "", /실패율 경고 기준/);

  const clicked = await evaluate(cdp, `(() => {
    const disclosure = document.querySelector('[data-testid="smoke-github-reference-history"]');
    const summary = disclosure?.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return false;
    summary.click();
    return true;
  })()`);
  assert.equal(clicked, true, "GitHub 참고 이력 펼침 항목을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const disclosure = document.querySelector('[data-testid="smoke-github-reference-history"]');
      const diagnostics = disclosure?.querySelector('[data-testid="smoke-github-rate-limit-audit-summary"]');
      const history = disclosure?.querySelector('[data-testid="smoke-recent-run-history"]');
      return disclosure?.open && Boolean(diagnostics?.getClientRects().length) &&
        Boolean(history?.getClientRects().length) && disclosure.innerText.includes('실패율 경고 기준') &&
        !disclosure.querySelector('[data-testid="smoke-history-refresh"]') &&
        !disclosure.querySelector('[data-testid="smoke-failure-type-increase-alert-test"]') &&
        !disclosure.querySelector('[data-testid="smoke-github-rate-limit-alert-test"]') &&
        !disclosure.querySelector('[data-testid="smoke-failure-metadata-management"]');
    })()`,
    timeoutMs,
    "GitHub 참고 이력을 펼친 뒤 기존 통계와 진단이 표시되지 않았습니다",
  );
  await evaluate(cdp, `document.querySelector(
    '[data-testid="smoke-github-reference-history"] > summary'
  )?.click()`);
  return true;
}

export async function checkSettingsTestAuditLinks({ cdp, timeoutMs }) {
  const result = await evaluate(cdp, `(() => {
    const histories = Array.from(
      document.querySelectorAll('[data-testid="settings-test-recent-history"]')
    );
    histories.forEach((history) => { history.open = true; });
    const links = Array.from(document.querySelectorAll('a[aria-label$="감사 상세"]'));
    const retryButtons = histories.flatMap((history) =>
      Array.from(history.querySelectorAll('button[data-retry-audit-id]'))
    );
    const retryRelationLinks = histories.flatMap((history) =>
      Array.from(history.querySelectorAll('a[data-retry-relation]'))
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
      expectedRetryRelationCount: histories.reduce((count, history) =>
        count + Array.from(history.querySelectorAll('li')).reduce((itemCount, item) =>
          itemCount + Number(Boolean(item.getAttribute('data-retry-of-audit-id'))) +
            Number(Boolean(item.getAttribute('data-retry-result-audit-id'))), 0
        ), 0
      ),
      retryRelationCount: retryRelationLinks.length,
      retryRelationValid: retryRelationLinks.every((link) => {
        const row = link.closest('li');
        const relation = link.getAttribute('data-retry-relation');
        const expectedId = relation === 'origin'
          ? row?.getAttribute('data-retry-of-audit-id')
          : row?.getAttribute('data-retry-result-audit-id');
        const url = new URL(link.href);
        return Boolean(expectedId) && url.pathname === '/dashboard/audit' &&
          url.searchParams.get('q') === expectedId && url.searchParams.get('expand') === expectedId;
      }),
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
  await checkSmokeRecentRunArtifact({ cdp, timeoutMs });
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
  assert.equal(
    result.retryRelationCount,
    result.expectedRetryRelationCount,
    "재시도 원본·결과 감사 링크 수가 일치하지 않습니다",
  );
  assert.equal(result.retryRelationValid, true, "재시도 원본·결과 감사 ID가 일치하지 않습니다");
  return true;
}

import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { checkSmokeRecentRunArtifact } from "./dashboard-visual-smoke-history.mjs";

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

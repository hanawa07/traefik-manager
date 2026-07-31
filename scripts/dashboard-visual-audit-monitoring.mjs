import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkAuditRetryChain({ cdp, timeoutMs }) {
  const targetAuditId = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit?limit=50&offset=0');
    if (!response.ok) return null;
    const logs = await response.json();
    const target = logs.find((log) =>
      typeof log.detail?.retry_of_audit_id === 'string' &&
        document.querySelector('[data-audit-log-id="' + CSS.escape(log.id) + '"]')
    );
    const row = target
      ? document.querySelector('[data-audit-log-id="' + CSS.escape(target.id) + '"]')
      : null;
    const button = Array.from(row?.querySelectorAll('button') || []).find(
      (item) => item.textContent?.trim() === '상세 보기'
    );
    button?.click();
    return button ? target.id : null;
  })()`);
  if (!targetAuditId) return false;

  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('[data-testid="audit-retry-chain"]'))`,
    timeoutMs,
    "알림 재시도 체인을 불러오지 못했습니다",
  );
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit/retry-chain/${targetAuditId}');
    const settingsResponse = await fetch('/api/v1/settings/security-alerts');
    const alertSettings = settingsResponse.ok ? await settingsResponse.json() : null;
    const chain = response.ok ? await response.json() : [];
    const panel = document.querySelector('[data-testid="audit-retry-chain"]');
    const items = Array.from(panel?.querySelectorAll('[data-chain-audit-id]') || []);
    const ids = items.map((item) => item.getAttribute('data-chain-audit-id'));
    const links = Array.from(panel?.querySelectorAll('a') || []);
    return {
      apiIds: chain.map((item) => item.id),
      count: items.length,
      currentCount: items.filter((item) => item.getAttribute('data-chain-current') === 'true').length,
      expectedCount: Number(panel?.getAttribute('data-chain-count')),
      expectedFailureCount: chain.filter((item) => item.detail?.success === false).length,
      expectedSuccessCount: chain.filter((item) => item.detail?.success === true).length,
      failureCount: Number(panel?.getAttribute('data-chain-failure-count')),
      firstIsOrigin: items[0]?.textContent?.includes('원본'),
      failureDetailsValid: items.every((item, index) => {
        const detail = chain[index]?.detail;
        const raw = detail?.detail;
        const expected = detail?.success === false
          ? typeof raw === 'string' && raw.trim() ? raw.trim() : '상세 정보 없음'
          : null;
        const summary = item.querySelector('[data-testid="audit-retry-failure-summary"]');
        return expected
          ? summary?.title === expected && summary.textContent?.includes(expected)
          : !summary;
      }),
      ids,
      linksValid: links.length === Math.max(0, items.length - 1) && links.every((link) => {
        const id = new URL(link.href).searchParams.get('q');
        return ids.includes(id);
      }),
      parentsValid: items.every((item, index) => {
        const parentId = item.getAttribute('data-chain-parent-id');
        return index === 0 ? !parentId : Boolean(parentId && ids.includes(parentId));
      }),
      responseOk: response.ok,
      retryDelaySettingValid: settingsResponse.ok &&
        Number(panel?.getAttribute('data-auto-retry-delay-warning-ms')) ===
          alertSettings?.automatic_retry_delay_warning_minutes * 60 * 1_000,
      recoveryValid: (() => {
        const firstFailureIndex = chain.findIndex((item) => item.detail?.success === false);
        const firstFailure = firstFailureIndex >= 0 ? chain[firstFailureIndex] : null;
        const firstSuccess = firstFailureIndex >= 0
          ? chain.slice(firstFailureIndex + 1).find((item) => item.detail?.success === true)
          : null;
        const recovery = panel?.querySelector('[data-testid="audit-retry-recovery-duration"]');
        if (!firstFailure) return !recovery;
        if (!firstSuccess) return recovery?.textContent?.includes('아직 성공 없음');
        const duration = Date.parse(firstSuccess.created_at) - Date.parse(firstFailure.created_at);
        return Number.isFinite(duration) && duration >= 0
          ? Number(recovery?.getAttribute('data-recovery-duration-ms')) === duration &&
              recovery?.textContent?.includes('최초 실패→성공')
          : recovery?.textContent?.includes('시간 확인 불가');
      })(),
      stageElapsedValid: items.every((item, index) => {
        const elapsed = item.querySelector('[data-testid="audit-retry-stage-elapsed"]');
        if (index === 0) return !elapsed;
        const duration = Date.parse(chain[index]?.created_at) -
          Date.parse(chain[index - 1]?.created_at);
        const delayThreshold = Number(panel?.getAttribute('data-auto-retry-delay-warning-ms'));
        const delayWarning = chain[index]?.detail?.trigger === 'automatic_retry' &&
          Number.isFinite(duration) && duration > delayThreshold;
        const warningValid = elapsed?.getAttribute('data-stage-delay-warning') === String(delayWarning) &&
          (!delayWarning || elapsed?.textContent?.includes('지연'));
        return Number.isFinite(duration) && duration >= 0
          ? Number(elapsed?.getAttribute('data-stage-elapsed-ms')) === duration &&
              elapsed?.textContent?.includes('이전 단계 후') && warningValid
          : elapsed?.textContent?.includes('경과 시간 확인 불가') && warningValid;
      }),
      successCount: Number(panel?.getAttribute('data-chain-success-count')),
      triggersValid: items.every((item, index) => {
        const trigger = chain[index]?.detail?.trigger;
        const expected = ['automatic_retry', 'manual_retry'].includes(trigger) ? trigger : null;
        const label = expected === 'automatic_retry' ? '자동' : expected === 'manual_retry' ? '수동' : null;
        return item.getAttribute('data-chain-trigger') === expected &&
          (!label || item.textContent?.includes(label));
      }),
    };
  })()`);
  assert.equal(result.responseOk, true, "알림 재시도 체인 API 응답을 받지 못했습니다");
  assert.ok(result.count > 1, "알림 재시도 체인이 한 건으로만 표시됐습니다");
  assert.equal(result.count, result.expectedCount, "알림 재시도 체인 표시 건수가 다릅니다");
  assert.deepEqual(result.ids, result.apiIds, "알림 재시도 체인 ID 순서가 API와 다릅니다");
  assert.equal(result.currentCount, 1, "알림 재시도 체인의 현재 로그 표시가 다릅니다");
  assert.equal(result.failureCount, result.expectedFailureCount, "알림 재시도 실패 요약 건수가 다릅니다");
  assert.equal(result.failureDetailsValid, true, "알림 재시도 체인의 실패 원인이 다릅니다");
  assert.equal(result.firstIsOrigin, true, "알림 재시도 체인의 원본 표시가 없습니다");
  assert.equal(result.parentsValid, true, "알림 재시도 체인의 부모 관계가 끊겼습니다");
  assert.equal(result.recoveryValid, true, "알림 재시도 체인의 복구 소요 시간이 다릅니다");
  assert.equal(result.retryDelaySettingValid, true, "알림 재시도 지연 설정이 체인에 반영되지 않았습니다");
  assert.equal(result.stageElapsedValid, true, "알림 재시도 단계별 경과 시간이 다릅니다");
  assert.equal(result.successCount, result.expectedSuccessCount, "알림 재시도 성공 요약 건수가 다릅니다");
  assert.equal(result.triggersValid, true, "알림 재시도 체인의 자동·수동 표시가 다릅니다");
  assert.equal(result.linksValid, true, "알림 재시도 체인의 감사 상세 링크가 다릅니다");
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

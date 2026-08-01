import assert from "node:assert/strict";

import {
  ALERT_RUN_URL,
  FIXTURE_DATE,
  reloadTraefikUpdateHistoryFixture,
} from "./dashboard-visual-traefik-update-history-fixture.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkTraefikUpdateHistory({ cdp, timeoutMs }) {
  await reloadTraefikUpdateHistoryFixture({ cdp, timeoutMs });
  await waitForCondition(
    cdp,
    `(() => {
      const entries = document.querySelectorAll(
        '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
      );
      const alert = document.querySelector('[data-traefik-update-alert="requested"]');
      const auditLink = alert?.querySelector('[data-traefik-update-alert-audit]');
      const auditUrl = auditLink ? new URL(auditLink.href) : null;
      return entries.length === 2 && alert?.textContent?.includes('알림 실행 성공') &&
        alert.textContent.includes('재시도 security-admin') &&
        auditUrl?.pathname === '/dashboard/audit' &&
        auditUrl.searchParams.get('q') === '33333333-3333-4333-8333-333333333333' &&
        auditUrl.searchParams.get('expand') === 'first' &&
        alert.querySelector('a')?.href === ${JSON.stringify(ALERT_RUN_URL)};
    })()`,
    timeoutMs,
    "Traefik 업데이트 알림 fixture가 표시되지 않았습니다",
  );

  await setInput({
    cdp,
    label: "요청자",
    selector: "[data-traefik-update-actor-filter]",
    value: "security-admin",
  });
  await setSelect({
    cdp,
    selector: "[data-traefik-update-retry-filter]",
    value: "retried",
  });
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return params.get('traefik_update_actor') === 'security-admin' &&
        params.get('traefik_update_retry') === 'retried' &&
        document.querySelectorAll(
          '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
        ).length === 1;
    })()`,
    timeoutMs,
    "Traefik 업데이트 요청자·재시도 필터가 적용되지 않았습니다",
  );
  await setSelect({
    cdp,
    selector: "[data-traefik-update-status-filter]",
    value: "rollback_failed",
  });
  await waitForCondition(
    cdp,
    `new URLSearchParams(location.search).get('traefik_update_status') ===
      'rollback_failed' && document.querySelectorAll(
        '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
      ).length === 1`,
    timeoutMs,
    "Traefik 업데이트 상태 필터가 적용되지 않았습니다",
  );
  await setInput({
    cdp,
    label: "시작일",
    selector: "[data-traefik-update-date-from]",
    value: FIXTURE_DATE,
  });
  await setInput({
    cdp,
    label: "종료일",
    selector: "[data-traefik-update-date-to]",
    value: FIXTURE_DATE,
  });
  await waitForFilterQuery(cdp, timeoutMs);

  await reloadTraefikUpdateHistoryFixture({ cdp, timeoutMs });
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-traefik-update-status-filter]')?.value ===
          'rollback_failed' &&
        document.querySelector('[data-traefik-update-actor-filter]')?.value ===
          'security-admin' &&
        document.querySelector('[data-traefik-update-retry-filter]')?.value === 'retried' &&
        document.querySelector('[data-traefik-update-period-filter]')?.value === 'all' &&
        document.querySelector('[data-traefik-update-date-from]')?.value ===
          ${JSON.stringify(FIXTURE_DATE)} &&
        document.querySelector('[data-traefik-update-date-to]')?.value ===
          ${JSON.stringify(FIXTURE_DATE)} &&
        params.get('traefik_update_status') === 'rollback_failed' &&
        document.querySelectorAll(
          '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
        ).length === 1;
    })()`,
    timeoutMs,
    "Traefik 업데이트 필터가 새로고침 후 복원되지 않았습니다",
  );

  const json = await captureDownload(cdp, "json");
  assert.match(
    json.filename,
    new RegExp(`traefik-updates-rollback_failed-${FIXTURE_DATE}-to-${FIXTURE_DATE}-\\d{4}-\\d{2}-\\d{2}\\.json$`),
  );
  const payload = JSON.parse(json.text);
  assert.equal(payload.metadata.schema_version, 4);
  assert.equal(payload.metadata.result_count, 1);
  assert.deepEqual(payload.metadata.filters, {
    date_from: FIXTURE_DATE,
    date_to: FIXTURE_DATE,
    period: "all",
    actor: "security-admin",
    retry: "retried",
    status: "rollback_failed",
  });
  assert.equal(payload.entries[0].alert_run_url, ALERT_RUN_URL);
  assert.equal(payload.entries[0].alert_retry_request_id, "33333333-3333-4333-8333-333333333333");
  assert.equal(payload.entries[0].alert_retry_actor, "security-admin");
  assert.equal(payload.entries[0].alert_run_conclusion, "success");

  const csv = await captureDownload(cdp, "csv");
  assert.deepEqual(csv.bytes, [239, 187, 191], "Traefik CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^metadata,value\r\n/);
  assert.match(csv.text, /\r\nschema_version,"4"\r\n/);
  assert.match(csv.text, /\r\nresult_count,"1"\r\n/);
  assert.match(csv.text, /\r\nfilter_actor,"security-admin"\r\n/);
  assert.match(csv.text, /\r\nfilter_retry,"retried"\r\n/);
  assert.match(csv.text, /alert_request_status,alert_run_url,alert_retry_request_id,alert_retry_actor/);
  assert.match(csv.text, /github\.com\/hanawa07\/traefik-manager\/actions\/runs\/123/);
  assert.match(csv.text, /security-admin/);
  assert.match(csv.text, /"'=smoke-admin"/);

  await evaluate(cdp, `document.querySelector('[data-traefik-update-filter-reset]')?.click()`);
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelectorAll(
        '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
      ).length === 2 && !params.has('traefik_update_status') &&
        !params.has('traefik_update_actor') && !params.has('traefik_update_retry') &&
        !params.has('traefik_update_period') && !params.has('traefik_update_from') &&
        !params.has('traefik_update_to');
    })()`,
    timeoutMs,
    "Traefik 업데이트 필터 초기화가 적용되지 않았습니다",
  );
  return true;
}

async function setSelect({ cdp, selector, value }) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Traefik 업데이트 ${selector} 선택 요소를 찾지 못했습니다`);
}

async function setInput({ cdp, label, selector, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Traefik 업데이트 ${label} 입력 요소를 찾지 못했습니다`);
}

async function waitForFilterQuery(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return params.get('traefik_update_from') === ${JSON.stringify(FIXTURE_DATE)} &&
        params.get('traefik_update_to') === ${JSON.stringify(FIXTURE_DATE)} &&
        params.get('traefik_update_actor') === 'security-admin' &&
        params.get('traefik_update_retry') === 'retried' &&
        !params.has('traefik_update_period');
    })()`,
    timeoutMs,
    "Traefik 업데이트 날짜 필터가 URL에 반영되지 않았습니다",
  );
}

async function captureDownload(cdp, format) {
  const result = await evaluate(cdp, `(async () => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-traefik-update-export="${format}"]`)},
    );
    if (!button) return null;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    let filename = '';
    try {
      URL.createObjectURL = (value) => { blob = value; return 'blob:traefik-update-smoke'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { filename = this.download; };
      button.click();
      if (!blob) return null;
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3));
      return { bytes, filename, text: await blob.text(), type: blob.type };
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  })()`);
  assert.ok(result, `Traefik ${format.toUpperCase()} 내보내기를 캡처하지 못했습니다`);
  return result;
}

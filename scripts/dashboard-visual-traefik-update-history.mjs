import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const DAY_MS = 24 * 60 * 60 * 1_000;
const FIXTURE_DATE = new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10);
const ALERT_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/123";

const FIXTURE = {
  runner: {
    available: true,
    status: "ready",
    checked_at: `${FIXTURE_DATE}T03:00:00Z`,
    message: "fixture ready",
  },
  pending_request: false,
  history: [
    {
      request_id: "11111111-1111-4111-8111-111111111111",
      actor: "=smoke-admin",
      status: "rollback_failed",
      from_version: "v3.7.8",
      target_version: "v3.7.9",
      requested_at: `${FIXTURE_DATE}T03:00:00Z`,
      started_at: `${FIXTURE_DATE}T03:00:01Z`,
      completed_at: `${FIXTURE_DATE}T03:00:05Z`,
      message: "fixture rollback failed",
      backup_dir: "/tmp/traefik-update-smoke",
      backup_created: true,
      rollback_performed: true,
      alert_request_status: "requested",
      alert_run_url: ALERT_RUN_URL,
      alert_retry_actor: "security-admin",
      alert_retry_requested_at: `${FIXTURE_DATE}T03:00:30Z`,
      alert_run_status: "completed",
      alert_run_conclusion: "success",
      alert_run_checked_at: `${FIXTURE_DATE}T03:01:00Z`,
      alert_run_error: null,
      validations: [
        { key: "container_version", status: "fail", message: "fixture mismatch" },
      ],
    },
    {
      request_id: "22222222-2222-4222-8222-222222222222",
      actor: "smoke-admin",
      status: "success",
      from_version: "v3.7.7",
      target_version: "v3.7.8",
      requested_at: "2026-01-01T03:00:00Z",
      started_at: "2026-01-01T03:00:01Z",
      completed_at: "2026-01-01T03:00:05Z",
      message: "fixture update completed",
      backup_dir: null,
      backup_created: true,
      rollback_performed: false,
      alert_request_status: "not_needed",
      alert_run_url: null,
      alert_retry_actor: null,
      alert_retry_requested_at: null,
      alert_run_status: null,
      alert_run_conclusion: null,
      alert_run_checked_at: null,
      alert_run_error: null,
      validations: [],
    },
  ],
};

export async function checkTraefikUpdateHistory({ cdp, timeoutMs }) {
  await reloadWithFixture({ cdp, timeoutMs });
  await waitForCondition(
    cdp,
    `(() => {
      const entries = document.querySelectorAll(
        '[data-testid="traefik-update-history"] li[data-traefik-update-status]',
      );
      const alert = document.querySelector('[data-traefik-update-alert="requested"]');
      return entries.length === 2 && alert?.textContent?.includes('알림 실행 성공') &&
        alert.textContent.includes('재시도 security-admin') &&
        alert.querySelector('a')?.href === ${JSON.stringify(ALERT_RUN_URL)};
    })()`,
    timeoutMs,
    "Traefik 업데이트 알림 fixture가 표시되지 않았습니다",
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
  await setDateInput({ cdp, kind: "from", value: FIXTURE_DATE });
  await setDateInput({ cdp, kind: "to", value: FIXTURE_DATE });
  await waitForFilterQuery(cdp, timeoutMs);

  await reloadWithFixture({ cdp, timeoutMs });
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('[data-traefik-update-status-filter]')?.value ===
          'rollback_failed' &&
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
  assert.equal(payload.metadata.schema_version, 3);
  assert.equal(payload.metadata.result_count, 1);
  assert.deepEqual(payload.metadata.filters, {
    date_from: FIXTURE_DATE,
    date_to: FIXTURE_DATE,
    period: "all",
    status: "rollback_failed",
  });
  assert.equal(payload.entries[0].alert_run_url, ALERT_RUN_URL);
  assert.equal(payload.entries[0].alert_retry_actor, "security-admin");
  assert.equal(payload.entries[0].alert_run_conclusion, "success");

  const csv = await captureDownload(cdp, "csv");
  assert.deepEqual(csv.bytes, [239, 187, 191], "Traefik CSV UTF-8 BOM이 없습니다");
  assert.match(csv.text, /^metadata,value\r\n/);
  assert.match(csv.text, /\r\nschema_version,"3"\r\n/);
  assert.match(csv.text, /\r\nresult_count,"1"\r\n/);
  assert.match(csv.text, /alert_request_status,alert_run_url,alert_retry_actor,alert_retry_requested_at/);
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
        !params.has('traefik_update_period') && !params.has('traefik_update_from') &&
        !params.has('traefik_update_to');
    })()`,
    timeoutMs,
    "Traefik 업데이트 필터 초기화가 적용되지 않았습니다",
  );
  return true;
}

async function reloadWithFixture({ cdp, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/traefik/update-operations*" }],
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
      body: Buffer.from(JSON.stringify(FIXTURE)).toString("base64"),
    });
    await loaded;
  } finally {
    await cdp.send("Fetch.disable");
  }
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

async function setDateInput({ cdp, kind, value }) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(
      ${JSON.stringify(`[data-traefik-update-date-${kind}]`)},
    );
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Traefik 업데이트 ${kind} 날짜를 입력하지 못했습니다`);
}

async function waitForFilterQuery(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return params.get('traefik_update_from') === ${JSON.stringify(FIXTURE_DATE)} &&
        params.get('traefik_update_to') === ${JSON.stringify(FIXTURE_DATE)} &&
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

import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const MANAGER_HTTP_AUDIT_FIXTURE_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_HTTP_STORAGE_AUDIT_FIXTURE_ID = "00000000-0000-4000-8000-000000000002";
const MANAGER_HTTP_AUDIT_FIXTURE = {
  id: MANAGER_HTTP_AUDIT_FIXTURE_ID,
  actor: "system",
  action: "alert",
  resource_type: "manager_component",
  resource_id: "manager-http-errors",
  resource_name: "Manager API 오류 임계치",
  event: "manager_http_errors_high",
  created_at: "2026-07-14T00:00:00Z",
  detail: {
    window_minutes: 15,
    not_found_count: 3,
    not_found_threshold: 2,
    server_error_count: 1,
    server_error_threshold: 1,
    excluded_paths: ["/api/health"],
    top_paths: [
      { path: "/api/v1/services", not_found_count: 3, server_error_count: 1 },
    ],
    checked_at: "2026-07-14T00:00:00Z",
    cooldown_minutes: 30,
  },
};
const MANAGER_HTTP_STORAGE_AUDIT_FIXTURE = {
  id: MANAGER_HTTP_STORAGE_AUDIT_FIXTURE_ID,
  actor: "system",
  action: "alert",
  resource_type: "manager_component",
  resource_id: "request-log-storage",
  resource_name: "Manager 요청 로그",
  event: "manager_http_log_storage_warning",
  created_at: "2026-07-13T23:59:00Z",
  detail: {
    status: "capacity",
    source: "persistent",
    size_bytes: 800,
    capacity_bytes: 1_000,
    usage_percent: 80,
    file_count: 5,
    max_file_count: 6,
    rotated_file_count: 4,
    warning_threshold_percent: 80,
    checked_at: "2026-07-13T23:59:00Z",
    cooldown_minutes: 60,
  },
};

export async function checkManagerHttpAuditAutoExpand(cdp, timeoutMs) {
  await evaluate(cdp, `history.replaceState(
    null,
    '',
    '/dashboard/audit?filter=manager_health&manager_source=api&period=1&expand=latest'
  )`);
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/audit\\?*" }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "X-Total-Count", value: "2" },
      ],
      body: Buffer.from(
        JSON.stringify([MANAGER_HTTP_STORAGE_AUDIT_FIXTURE, MANAGER_HTTP_AUDIT_FIXTURE]),
      ).toString("base64"),
    });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const row = document.querySelector('[data-audit-log-id="' + CSS.escape(${JSON.stringify(MANAGER_HTTP_STORAGE_AUDIT_FIXTURE_ID)}) + '"]');
        const detail = row?.nextElementSibling?.querySelector('[data-testid="manager-http-audit-detail"]');
        return document.querySelector('select[aria-label="Manager 소스"]')?.value === 'api' &&
          document.querySelector('select[aria-label="감사 기간"]')?.value === '1' &&
          detail?.textContent?.includes('용량 사용률') &&
          detail.textContent.includes('영속 볼륨');
      })()`,
      timeoutMs,
      "Manager 요청 로그 보관 감사 fixture가 자동으로 펼쳐지지 않았습니다",
    );
    const apiExpanded = await evaluate(cdp, `(() => {
      const row = document.querySelector('[data-audit-log-id="' + CSS.escape(${JSON.stringify(MANAGER_HTTP_AUDIT_FIXTURE_ID)}) + '"]');
      const button = [...(row?.querySelectorAll('button') || [])].find((item) => item.textContent?.includes('상세 보기'));
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(apiExpanded, true, "Manager API 감사 상세 버튼이 없습니다");
    await waitForCondition(
      cdp,
      `(() => {
        const row = document.querySelector('[data-audit-log-id="' + CSS.escape(${JSON.stringify(MANAGER_HTTP_AUDIT_FIXTURE_ID)}) + '"]');
        const detail = row?.nextElementSibling?.querySelector('[data-testid="manager-http-audit-detail"]');
        return detail?.textContent?.includes('집계 구간') &&
          detail.textContent.includes('/api/v1/services');
      })()`,
      timeoutMs,
      "Manager API 감사 fixture 상세가 표시되지 않았습니다",
    );
    return true;
  } finally {
    await cdp.send("Fetch.disable");
  }
}

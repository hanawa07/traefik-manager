import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const BULK_OPERATION_ID = "00000000-0000-4000-8000-000000000201";
const DELIVERY_ID = "00000000-0000-4000-8000-000000000301";
const RETRY_ID = "00000000-0000-4000-8000-000000000302";

export async function checkAuditBulkOperationFixture({ canManage, cdp, timeoutMs }) {
  if (!canManage) return false;
  const origin = await evaluate(cdp, "location.origin");
  const summary = buildBulkOperationSummary();
  await cdp.send("Fetch.enable", {
    patterns: [
      { requestStage: "Request", urlPattern: "*/api/v1/audit/bulk-operations*" },
      { requestStage: "Request", urlPattern: "*/api/v1/audit/retry-chain/*" },
    ],
  });
  try {
    const initialRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 최초 목록");
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${origin}/dashboard/audit` });
    const initial = await initialRequest;
    assertRequest(initial, "GET", "/api/v1/audit/bulk-operations");
    await fulfillJson(cdp, initial, [summary], 6);
    await loaded;
    await waitForBulkControls(cdp, "all", "all", timeoutMs);

    const nextPageRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 다음 페이지");
    await clickAriaLabel(cdp, "다음 일괄 작업 페이지");
    const nextPage = await nextPageRequest;
    assert.equal(new URL(nextPage.request.url).searchParams.get("offset"), "5");
    await fulfillJson(cdp, nextPage, [summary], 6);
    await waitForBulkControls(cdp, "all", "all", timeoutMs, 2);

    await clickAriaLabel(cdp, "이전 일괄 작업 페이지");
    await waitForBulkControls(cdp, "all", "all", timeoutMs);

    const periodRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 기간 필터");
    await changeSelect(cdp, "일괄 작업 기간", "30");
    const period = await periodRequest;
    assert.equal(new URL(period.request.url).searchParams.get("period_days"), "30");
    await fulfillJson(cdp, period, [summary], 6);
    await waitForBulkControls(cdp, "30", "all", timeoutMs);

    const statusRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 상태 필터");
    await changeSelect(cdp, "일괄 작업 알림 상태", "failure");
    const status = await statusRequest;
    const statusUrl = new URL(status.request.url);
    assert.equal(statusUrl.searchParams.get("period_days"), "30");
    assert.equal(statusUrl.searchParams.get("notification_status"), "failure");
    await fulfillJson(cdp, status, [summary], 6);
    await waitForBulkControls(cdp, "30", "failure", timeoutMs);

    const reloadRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 필터 새로고침");
    const reloaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const reload = await reloadRequest;
    const reloadUrl = new URL(reload.request.url);
    assert.equal(reloadUrl.searchParams.get("period_days"), "30");
    assert.equal(reloadUrl.searchParams.get("notification_status"), "failure");
    await fulfillJson(cdp, reload, [summary], 6);
    await reloaded;
    await waitForBulkControls(cdp, "30", "failure", timeoutMs);
    await waitForCondition(
      cdp,
      `(() => {
        const card = document.querySelector('[data-bulk-operation-id="${BULK_OPERATION_ID}"]');
        return card?.textContent?.includes('전송 2회') &&
          card.textContent.includes('최근 실패 원인: 스모크 최종 전송 실패');
      })()`,
      timeoutMs,
      "일괄 작업 재시도 횟수와 최근 실패 원인이 표시되지 않았습니다",
    );

    const chainRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 재시도 이력");
    await clickAriaLabel(cdp, `${BULK_OPERATION_ID} 알림 재시도 전체 이력`);
    const chain = await chainRequest;
    assertRequest(chain, "GET", `/api/v1/audit/retry-chain/${RETRY_ID}`);
    await fulfillJson(cdp, chain, buildRetryChain());
    await waitForCondition(
      cdp,
      `(() => {
        const panel = document.querySelector('[data-testid="audit-retry-chain"]');
        return panel?.getAttribute('data-chain-count') === '2' &&
          panel.textContent?.includes('스모크 최초 전송 실패') &&
          panel.textContent.includes('스모크 최종 전송 실패');
      })()`,
      timeoutMs,
      "일괄 작업의 전체 재시도 이력이 펼쳐지지 않았습니다",
    );

    const resetRequest = waitForFetch(cdp, timeoutMs, "일괄 작업 전체 필터 초기화");
    await clickAriaLabel(cdp, "감사 필터 전체 초기화");
    const reset = await resetRequest;
    const resetUrl = new URL(reset.request.url);
    assert.equal(resetUrl.searchParams.has("period_days"), false);
    assert.equal(resetUrl.searchParams.has("notification_status"), false);
    await fulfillJson(cdp, reset, [summary], 6);
    await waitForBulkControls(cdp, "all", "all", timeoutMs);
    await waitForCondition(
      cdp,
      `document.querySelector('button[aria-label="감사 필터 전체 초기화"]')?.disabled === true &&
        document.body.innerText.includes('적용 조건') && document.body.innerText.includes('전체 로그')`,
      timeoutMs,
      "전체 초기화가 일괄 작업 조건까지 제거하지 못했습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }
  return true;
}

async function waitForBulkControls(cdp, period, status, timeoutMs, page = 1) {
  const periodLabel = { "7": "최근 7일", "30": "최근 30일", "90": "최근 90일" }[period];
  const statusLabel = { success: "성공", failure: "실패", none: "기록 없음" }[status];
  await waitForCondition(
    cdp,
    `(() => {
      const params = new URLSearchParams(location.search);
      return document.querySelector('select[aria-label="일괄 작업 기간"]')?.value === ${JSON.stringify(period)} &&
        document.querySelector('select[aria-label="일괄 작업 알림 상태"]')?.value === ${JSON.stringify(status)} &&
        document.querySelector('[data-bulk-result-count]')?.getAttribute('data-bulk-result-count') === '1' &&
        document.querySelector('[data-bulk-result-count]')?.getAttribute('data-bulk-total-count') === '6' &&
        document.querySelector('[data-bulk-result-count]')?.textContent?.includes('조건 결과 6건 · 현재 1건 표시') &&
        document.querySelector('[data-bulk-page]')?.getAttribute('data-bulk-page') === '${page}' &&
        document.querySelector('[data-bulk-page]')?.getAttribute('data-bulk-total-pages') === '2' &&
        ${period === "all" ? "!params.has('bulk_period')" : `params.get('bulk_period') === '${period}'`} &&
        ${status === "all" ? "!params.has('bulk_status')" : `params.get('bulk_status') === '${status}'`} &&
        ${periodLabel ? `Boolean(document.querySelector('button[aria-label="일괄 기간: ${periodLabel} 조건 제거"]'))` : `!document.querySelector('button[aria-label^="일괄 기간:"]')`} &&
        ${statusLabel ? `Boolean(document.querySelector('button[aria-label="일괄 알림: ${statusLabel} 조건 제거"]'))` : `!document.querySelector('button[aria-label^="일괄 알림:"]')`};
    })()`,
    timeoutMs,
    "일괄 작업 URL 필터가 화면에 복원되지 않았습니다",
  );
}

async function changeSelect(cdp, label, value) {
  const changed = await evaluate(cdp, `(() => {
    const select = document.querySelector(${JSON.stringify(`select[aria-label="${label}"]`)});
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label}: 선택 항목을 찾지 못했습니다`);
}

function assertRequest(request, method, pathname) {
  assert.equal(request.request.method, method);
  assert.equal(new URL(request.request.url).pathname, pathname);
}

async function waitForFetch(cdp, timeoutMs, label) {
  try {
    return await cdp.waitFor("Fetch.requestPaused", timeoutMs);
  } catch (error) {
    const state = await evaluate(cdp, `({
      period: document.querySelector('select[aria-label="일괄 작업 기간"]')?.value,
      status: document.querySelector('select[aria-label="일괄 작업 알림 상태"]')?.value,
      url: location.href,
    })`);
    throw new Error(`${label}: ${error.message} (${JSON.stringify(state)})`);
  }
}

async function fulfillJson(cdp, request, value, totalCount) {
  const responseHeaders = [{ name: "Content-Type", value: "application/json" }];
  if (totalCount !== undefined) {
    responseHeaders.push({ name: "X-Total-Count", value: String(totalCount) });
  }
  await cdp.send("Fetch.fulfillRequest", {
    requestId: request.requestId,
    responseCode: 200,
    responseHeaders,
    body: Buffer.from(JSON.stringify(value)).toString("base64"),
  });
}

function buildBulkOperationSummary() {
  return {
    operation_id: BULK_OPERATION_ID,
    actor: "smoke-admin",
    service_count: 2,
    service_names: ["English", "Manager"],
    routing_mode_after: "maintenance",
    completed_at: "2026-07-19T16:00:00Z",
    notification_status: "failure",
    notification_audit_id: RETRY_ID,
    notification_provider: "telegram",
    notification_attempt_count: 2,
    last_failure_detail: "스모크 최종 전송 실패",
  };
}

function buildRetryChain() {
  return [
    buildDelivery(DELIVERY_ID, "2026-07-19T16:00:01Z", "스모크 최초 전송 실패"),
    buildDelivery(RETRY_ID, "2026-07-19T16:01:01Z", "스모크 최종 전송 실패", DELIVERY_ID),
  ];
}

function buildDelivery(id, createdAt, detail, retryOfAuditId = null) {
  return {
    id,
    actor: "system",
    action: "alert",
    resource_type: "settings",
    resource_id: BULK_OPERATION_ID,
    resource_name: "운영 변경 알림 전송 결과",
    event: "change_alert_delivery_failure",
    created_at: createdAt,
    detail: {
      detail,
      provider: "telegram",
      retry_of_audit_id: retryOfAuditId,
      source_event: "service_update",
      source_resource_id: BULK_OPERATION_ID,
      source_resource_type: "service",
      success: false,
      trigger: retryOfAuditId ? "manual_retry" : null,
    },
  };
}

export function runAuditBulkOperationFixtureSelfTest() {
  const summary = buildBulkOperationSummary();
  const chain = buildRetryChain();
  assert.equal(summary.notification_attempt_count, chain.length);
  assert.equal(summary.notification_audit_id, chain[1].id);
  assert.equal(chain[1].detail.retry_of_audit_id, DELIVERY_ID);
}

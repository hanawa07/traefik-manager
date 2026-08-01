import assert from "node:assert/strict";

export const BULK_OPERATION_ID = "00000000-0000-4000-8000-000000000201";
const DELIVERY_ID = "00000000-0000-4000-8000-000000000301";
export const RETRY_ID = "00000000-0000-4000-8000-000000000302";

export function buildBulkOperationSummary() {
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

export function buildRetryChain() {
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

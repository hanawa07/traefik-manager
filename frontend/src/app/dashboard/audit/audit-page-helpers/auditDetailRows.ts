import { isRecord } from "./auditValueFormatters";

export function getAuditDiffRows(detail: Record<string, unknown> | null) {
  if (!detail) return [];
  const before = isRecord(detail.before) ? detail.before : null;
  const after = isRecord(detail.after) ? detail.after : null;
  if (!before || !after) return [];

  const changedKeys = Array.isArray(detail.changed_keys)
    ? detail.changed_keys.filter((item): item is string => typeof item === "string")
    : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return changedKeys.map((key) => ({
    key,
    before: before[key],
    after: after[key],
  }));
}

export function getDeliveryDetailRows(detail: Record<string, unknown> | null) {
  if (!detail) return [];
  const rows = [
    { key: "provider", label: "채널", value: detail.provider },
    { key: "source_event", label: "원본 이벤트", value: detail.source_event },
    { key: "source_action", label: "원본 작업", value: detail.source_action },
    { key: "source_resource_type", label: "원본 타입", value: detail.source_resource_type },
    { key: "source_resource_name", label: "원본 이름", value: detail.source_resource_name },
    { key: "client_ip", label: "IP", value: detail.client_ip },
    { key: "detail", label: "전송 상세", value: detail.detail },
    { key: "retry_of_audit_id", label: "재시도 원본", value: detail.retry_of_audit_id },
    { key: "trigger", label: "트리거", value: detail.trigger },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}

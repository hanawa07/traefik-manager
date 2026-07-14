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

export function isManagerHttpErrorEvent(value: unknown): value is string {
  return value === "manager_http_errors_high" || value === "manager_http_errors_recovered";
}

export function getManagerHttpErrorDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (!isManagerHttpErrorEvent(event) || !detail) return [];
  const rows = [
    { key: "window_minutes", label: "집계 구간", value: withUnit(detail.window_minutes, "분") },
    { key: "not_found_count", label: "404 발생", value: withUnit(detail.not_found_count, "건") },
    { key: "not_found_threshold", label: "404 임계치", value: withUnit(detail.not_found_threshold, "건") },
    { key: "server_error_count", label: "5xx 발생", value: withUnit(detail.server_error_count, "건") },
    { key: "server_error_threshold", label: "5xx 임계치", value: withUnit(detail.server_error_threshold, "건") },
    { key: "excluded_paths", label: "제외 경로", value: detail.excluded_paths },
    { key: "top_paths", label: "상위 발생 경로", value: formatTopPaths(detail.top_paths) },
    { key: "checked_at", label: "점검 시각", value: detail.checked_at },
    { key: "cooldown_minutes", label: "재알림 대기", value: withUnit(detail.cooldown_minutes, "분") },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}

export function isManagerHttpLogStorageEvent(value: unknown): value is string {
  return (
    value === "manager_http_log_storage_warning" ||
    value === "manager_http_log_storage_recovered"
  );
}

export function getManagerHttpLogStorageDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (!isManagerHttpLogStorageEvent(event) || !detail) return [];
  const rows = [
    { key: "status", label: "보관 상태", value: formatStorageStatus(detail.status) },
    { key: "source", label: "보관 소스", value: formatStorageSource(detail.source) },
    { key: "usage_percent", label: "용량 사용률", value: withUnit(detail.usage_percent, "%") },
    { key: "size_bytes", label: "사용량", value: withUnit(detail.size_bytes, " bytes") },
    { key: "capacity_bytes", label: "총 용량", value: withUnit(detail.capacity_bytes, " bytes") },
    { key: "file_count", label: "현재 파일", value: withUnit(detail.file_count, "개") },
    { key: "max_file_count", label: "최대 파일", value: withUnit(detail.max_file_count, "개") },
    { key: "rotated_file_count", label: "회전 파일", value: withUnit(detail.rotated_file_count, "개") },
    { key: "warning_threshold_percent", label: "경고 기준", value: withUnit(detail.warning_threshold_percent, "%") },
    { key: "checked_at", label: "점검 시각", value: detail.checked_at },
    { key: "cooldown_minutes", label: "재알림 대기", value: withUnit(detail.cooldown_minutes, "분") },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}

function withUnit(value: unknown, unit: string) {
  return typeof value === "number" ? `${value}${unit}` : value;
}

function formatStorageStatus(value: unknown) {
  const labels: Record<string, string> = {
    healthy: "정상",
    capacity: "용량 경고",
    docker: "Docker 폴백",
    unavailable: "사용 불가",
  };
  return typeof value === "string" ? (labels[value] ?? value) : value;
}

function formatStorageSource(value: unknown) {
  const labels: Record<string, string> = {
    persistent: "영속 볼륨",
    docker: "Docker 로그 폴백",
    unavailable: "사용 불가",
  };
  return typeof value === "string" ? (labels[value] ?? value) : value;
}

function formatTopPaths(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const paths = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.path !== "string") return [];
    const notFound = typeof item.not_found_count === "number" ? item.not_found_count : 0;
    const serverError = typeof item.server_error_count === "number" ? item.server_error_count : 0;
    return [`${item.path} (404 ${notFound}, 5xx ${serverError})`];
  });
  return paths.length > 0 ? paths : undefined;
}

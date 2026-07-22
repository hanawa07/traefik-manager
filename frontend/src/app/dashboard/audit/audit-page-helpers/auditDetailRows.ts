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
    {
      key: "success",
      label: "결과",
      value: detail.success === true ? "성공" : detail.success === false ? "실패" : undefined,
    },
    { key: "message", label: "메시지", value: detail.message },
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

export function getDeploymentBottleneckCleanupDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (event !== "deployment_bottleneck_events_cleanup" || !detail) return [];
  const rows = [
    { key: "retention_days", label: "적용 보관 기간", value: withUnit(detail.retention_days, "일") },
    { key: "previous_event_count", label: "정리 전 이벤트", value: withUnit(detail.previous_event_count, "건") },
    { key: "deleted_count", label: "삭제한 이벤트", value: withUnit(detail.deleted_count, "건") },
    { key: "retained_event_count", label: "남은 이벤트", value: withUnit(detail.retained_event_count, "건") },
    { key: "client_ip", label: "요청 IP", value: detail.client_ip },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}

export function isManagerHttpErrorEvent(value: unknown): value is string {
  return (
    value === "manager_http_errors_high" ||
    value === "manager_http_errors_recovered" ||
    value === "manager_settings_history_latency_high" ||
    value === "manager_settings_history_latency_recovered"
  );
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
    { key: "path", label: "대상 경로", value: detail.path },
    { key: "p95_ms", label: "p95", value: withUnit(detail.p95_ms, "ms") },
    { key: "threshold_ms", label: "p95 기준", value: withUnit(detail.threshold_ms, "ms") },
    { key: "sample_count", label: "표본", value: withUnit(detail.sample_count, "건") },
    { key: "minimum_sample_count", label: "최소 표본", value: withUnit(detail.minimum_sample_count, "건") },
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

export function getDeploymentBottleneckStorageDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (
    (event !== "manager_deployment_bottleneck_storage_warning" &&
      event !== "manager_deployment_bottleneck_storage_recovered") ||
    !detail
  ) return [];
  const rows = [
    { key: "event_count", label: "현재 이벤트", value: withUnit(detail.event_count, "건") },
    { key: "previous_event_count", label: "이전 이벤트", value: withUnit(detail.previous_event_count, "건") },
    { key: "warning_event_count", label: "경고 기준", value: withUnit(detail.warning_event_count, "건") },
    { key: "max_event_count", label: "최대 보관", value: withUnit(detail.max_event_count, "건") },
    { key: "alert_run_url", label: "호스트 알림 실행", value: detail.alert_run_url },
    { key: "alerted_at", label: "호스트 알림 시각", value: detail.alerted_at },
    { key: "checked_at", label: "수집 시각", value: detail.checked_at },
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

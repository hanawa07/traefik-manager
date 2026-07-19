interface AuditDiffRow {
  key: string;
  before: unknown;
  after: unknown;
}

interface SettingMeta {
  label: string;
  unit?: string;
  valueLabels?: Record<string, string>;
}

const SECURITY_SETTINGS_BY_EVENT: Record<string, Record<string, SettingMeta>> = {
  settings_update_security_alert: {
    enabled: { label: "보안 이벤트 알림" },
    change_alerts_enabled: { label: "운영 변경 알림" },
    manager_health_monitoring_enabled: { label: "Manager 상태 감시" },
    manager_health_alert_cooldown_minutes: { label: "Manager 재알림 대기", unit: "분" },
    external_watchdog_stale_minutes: { label: "Watchdog 지연 기준", unit: "분" },
    automatic_retry_delay_warning_minutes: { label: "자동 재시도 지연 임계치", unit: "분" },
    manager_http_error_monitoring_enabled: { label: "Manager HTTP 오류 감시" },
    manager_http_error_window_minutes: { label: "HTTP 오류 집계 구간", unit: "분" },
    manager_http_not_found_threshold: { label: "404 경고 임계치", unit: "건" },
    manager_http_server_error_threshold: { label: "5xx 경고 임계치", unit: "건" },
    manager_http_excluded_paths_count: { label: "HTTP 감시 제외 경로", unit: "개" },
    provider: {
      label: "기본 알림 채널",
      valueLabels: { generic: "Webhook", pagerduty: "PagerDuty", telegram: "Telegram" },
    },
  },
  settings_update_login_defense: {
    suspicious_block_enabled: { label: "의심 IP 자동 차단" },
    suspicious_trusted_networks_count: { label: "신뢰 네트워크", unit: "개" },
    suspicious_block_escalation_enabled: { label: "반복 공격 차단 강화" },
    suspicious_block_escalation_window_minutes: { label: "반복 공격 판정 구간", unit: "분" },
    suspicious_block_escalation_multiplier: { label: "차단 시간 배수", unit: "배" },
    suspicious_block_max_minutes: { label: "최대 차단 시간", unit: "분" },
    turnstile_mode: {
      label: "Turnstile 모드",
      valueLabels: { always: "항상", off: "사용 안 함", risk_based: "위험 기반" },
    },
    turnstile_enabled: { label: "Turnstile 활성 상태" },
  },
};

export function getAuditSecuritySettingChanges(
  event: unknown,
  rows: readonly AuditDiffRow[],
) {
  const settings = typeof event === "string" ? SECURITY_SETTINGS_BY_EVENT[event] : undefined;
  if (!settings) return [];

  return rows.flatMap((row) => {
    const meta = settings[row.key];
    if (!meta || Object.is(row.before, row.after)) return [];
    const beforeLabel = formatSettingValue(row.before, meta);
    const afterLabel = formatSettingValue(row.after, meta);
    if (beforeLabel === null || afterLabel === null) return [];
    const delta = numericDelta(row.before, row.after, meta.unit);
    return [{
      afterLabel,
      beforeLabel,
      deltaLabel: delta?.label ?? null,
      direction: delta?.direction ?? null,
      key: row.key,
      label: meta.label,
    }];
  });
}

function formatSettingValue(value: unknown, meta: SettingMeta) {
  if (typeof value === "boolean") return value ? "사용" : "사용 안 함";
  if (typeof value === "number" && Number.isFinite(value)) return `${value}${meta.unit ?? ""}`;
  if (typeof value === "string") return meta.valueLabels?.[value] ?? value;
  return null;
}

function numericDelta(before: unknown, after: unknown, unit = "") {
  if (typeof before !== "number" || typeof after !== "number") return null;
  const value = after - before;
  if (!Number.isFinite(value) || value === 0) return null;
  return {
    direction: value > 0 ? "up" : "down",
    label: `${value > 0 ? "+" : ""}${value}${unit}`,
  } as const;
}

export const auditFilters = [
  { key: "all", label: "전체" },
  { key: "security", label: "보안 이벤트" },
  { key: "alert_delivery", label: "알림 전송" },
  { key: "settings_update", label: "설정 변경" },
  { key: "settings_test", label: "설정 테스트" },
  { key: "settings_rollback", label: "설정 롤백" },
  { key: "login_locked", label: "계정 잠금" },
  { key: "login_suspicious", label: "이상 징후" },
  { key: "login_blocked_ip", label: "IP 차단" },
  { key: "login_failure", label: "로그인 실패" },
  { key: "manager_health", label: "Manager 전체" },
  { key: "manager_docker", label: "Manager Docker" },
  { key: "manager_watchdog", label: "Watchdog" },
  { key: "manager_unhealthy", label: "Manager 이상" },
  { key: "manager_recovered", label: "Manager 복구" },
  { key: "certificate_warning", label: "인증서 만료 임박" },
  { key: "certificate_error", label: "인증서 만료" },
  { key: "certificate_recovered", label: "인증서 복구" },
  { key: "certificate_preflight", label: "인증서 사전 진단" },
  { key: "certificate_preflight_repeated_failure", label: "인증서 반복 실패" },
] as const;

export const deliveryStatusOptions = [
  { key: "all", label: "전송 상태 전체" },
  { key: "success", label: "전송 성공" },
  { key: "failure", label: "전송 실패" },
] as const;

export const deliveryProviderOptions = [
  { key: "all", label: "채널 전체" },
  { key: "generic", label: "Generic" },
  { key: "slack", label: "Slack" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
  { key: "teams", label: "Teams" },
  { key: "pagerduty", label: "PagerDuty" },
  { key: "email", label: "Email" },
] as const;

export const managerHealthWindowOptions = [
  { minutes: 1440, label: "24시간" },
  { minutes: 10080, label: "7일" },
  { minutes: 43200, label: "30일" },
] as const;

export type AuditFilterKey = (typeof auditFilters)[number]["key"];
export type DeliveryStatusKey = (typeof deliveryStatusOptions)[number]["key"];
export type DeliveryProviderKey = (typeof deliveryProviderOptions)[number]["key"];
export type ManagerHealthWindowMinutes = (typeof managerHealthWindowOptions)[number]["minutes"];

export function isAuditFilterKey(value: string | null): value is AuditFilterKey {
  return auditFilters.some((filter) => filter.key === value);
}

export function parseManagerHealthWindowMinutes(
  value: string | null,
): ManagerHealthWindowMinutes {
  const minutes = Number(value);
  return managerHealthWindowOptions.some((option) => option.minutes === minutes)
    ? (minutes as ManagerHealthWindowMinutes)
    : 10080;
}

import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
} from "@/features/settings/api/settingsApi";

export const SECURITY_ALERT_EVENT_OPTIONS: Array<{
  key: SecurityAlertRouteEvent;
  label: string;
}> = [
  { key: "login_locked", label: "계정 잠금" },
  { key: "login_suspicious", label: "이상 징후" },
  { key: "login_blocked_ip", label: "IP 차단" },
];

export const CHANGE_ALERT_EVENT_OPTIONS: Array<{
  key: ChangeAlertRouteEvent;
  label: string;
}> = [
  { key: "settings_change", label: "설정 변경" },
  { key: "service_change", label: "서비스 변경" },
  { key: "redirect_change", label: "리다이렉트 변경" },
  { key: "middleware_change", label: "미들웨어 변경" },
  { key: "user_change", label: "사용자 변경" },
  { key: "certificate_status_change", label: "인증서 상태 전이" },
  { key: "certificate_preflight_failure", label: "인증서 반복 실패" },
  { key: "manager_health", label: "Manager Docker 상태" },
  { key: "rollback", label: "롤백" },
];

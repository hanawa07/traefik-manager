import type { SecurityAlertRouteTarget } from "@/features/settings/api/settingsApi";

export const SECURITY_ALERT_ROUTE_OPTIONS: Array<{
  value: SecurityAlertRouteTarget;
  label: string;
}> = [
  { value: "default", label: "기본 채널 사용" },
  { value: "disabled", label: "전송 안 함" },
  { value: "telegram", label: "Telegram" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "email", label: "Email" },
];

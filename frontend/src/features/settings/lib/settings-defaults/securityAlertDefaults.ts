import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
} from "@/features/settings/api/settingsApi";

export function createDefaultSecurityAlertForm(): SecurityAlertSettingsInput {
  return {
    enabled: false,
    change_alerts_enabled: false,
    provider: "generic",
    webhook_url: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
    pagerduty_routing_key: "",
    email_host: "",
    email_port: 587,
    email_security: "starttls",
    email_username: "",
    email_password: "",
    email_from: "",
    email_recipients: [],
    event_routes: {
      login_locked: "default",
      login_suspicious: "default",
      login_blocked_ip: "default",
    },
    change_event_routes: {
      settings_change: "default",
      service_change: "default",
      redirect_change: "default",
      middleware_change: "default",
      user_change: "default",
      certificate_status_change: "default",
      certificate_preflight_failure: "default",
      rollback: "default",
    },
  };
}

export const SECURITY_ALERT_PROVIDER_OPTIONS = [
  {
    value: "generic",
    label: "Generic Webhook",
    description: "임의의 JSON webhook endpoint로 원본 이벤트를 전송합니다.",
    placeholder: "https://hooks.example.com/security-alerts",
  },
  {
    value: "slack",
    label: "Slack",
    description: "Slack Incoming Webhook 형식으로 전송합니다.",
    placeholder: "https://hooks.slack.com/services/XXX/YYY/ZZZ",
  },
  {
    value: "discord",
    label: "Discord",
    description: "Discord webhook embed 형식으로 전송합니다.",
    placeholder: "https://discord.com/api/webhooks/123/abc",
  },
  {
    value: "telegram",
    label: "Telegram",
    description: "Bot API sendMessage로 전송합니다.",
    placeholder: "",
  },
  {
    value: "teams",
    label: "Microsoft Teams",
    description: "Teams Incoming Webhook의 Adaptive Card 형식으로 전송합니다.",
    placeholder: "https://example.webhook.office.com/webhookb2/...",
  },
  {
    value: "pagerduty",
    label: "PagerDuty",
    description: "PagerDuty Events API v2 trigger 이벤트로 전송합니다.",
    placeholder: "",
  },
  {
    value: "email",
    label: "Email",
    description: "SMTP를 통해 이메일 경고를 전송합니다.",
    placeholder: "",
  },
] as const;

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
  { key: "rollback", label: "롤백" },
];

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

import type {
  CertificateDiagnosticsSettingsInput,
  ChangeAlertRouteEvent,
  CloudflareZoneInput,
  LoginDefenseSettingsInput,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
  TraefikDashboardSettingsInput,
  UpstreamSecuritySettingsInput,
} from "@/features/settings/api/settingsApi";

export type UpstreamSecurityForm = UpstreamSecuritySettingsInput & {
  allowed_domain_suffixes_text: string;
};

export type LoginDefenseForm = LoginDefenseSettingsInput & {
  suspicious_trusted_networks_text: string;
};

export function createDefaultUpstreamSecurityForm(): UpstreamSecurityForm {
  return {
    dns_strict_mode: false,
    allowlist_enabled: false,
    allowed_domain_suffixes: [],
    allowed_domain_suffixes_text: "",
    allow_docker_service_names: true,
    allow_private_networks: true,
  };
}

export function createDefaultCloudflareZoneForm(): CloudflareZoneInput {
  return {
    api_token: "",
    zone_id: "",
    record_target: "",
    proxied: false,
  };
}

export function createDefaultTraefikDashboardForm(): TraefikDashboardSettingsInput {
  return {
    enabled: false,
    domain: "",
    auth_username: "",
    auth_password: "",
  };
}

export function createDefaultCertificateDiagnosticsForm(): CertificateDiagnosticsSettingsInput {
  return {
    auto_check_interval_minutes: 60,
    repeat_alert_threshold: 3,
    repeat_alert_window_minutes: 240,
    repeat_alert_cooldown_minutes: 240,
  };
}

export function createDefaultLoginDefenseForm(): LoginDefenseForm {
  return {
    suspicious_block_enabled: true,
    suspicious_trusted_networks: [],
    suspicious_trusted_networks_text: "",
    suspicious_block_escalation_enabled: false,
    suspicious_block_escalation_window_minutes: 1440,
    suspicious_block_escalation_multiplier: 2,
    suspicious_block_max_minutes: 1440,
    turnstile_mode: "off",
    turnstile_site_key: "",
    turnstile_secret_key: "",
  };
}

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

export const SECURITY_ALERT_EVENT_OPTIONS: Array<{ key: SecurityAlertRouteEvent; label: string }> = [
  { key: "login_locked", label: "계정 잠금" },
  { key: "login_suspicious", label: "이상 징후" },
  { key: "login_blocked_ip", label: "IP 차단" },
];

export const CHANGE_ALERT_EVENT_OPTIONS: Array<{ key: ChangeAlertRouteEvent; label: string }> = [
  { key: "settings_change", label: "설정 변경" },
  { key: "service_change", label: "서비스 변경" },
  { key: "redirect_change", label: "리다이렉트 변경" },
  { key: "middleware_change", label: "미들웨어 변경" },
  { key: "user_change", label: "사용자 변경" },
  { key: "certificate_status_change", label: "인증서 상태 전이" },
  { key: "certificate_preflight_failure", label: "인증서 반복 실패" },
  { key: "rollback", label: "롤백" },
];

export const SECURITY_ALERT_ROUTE_OPTIONS: Array<{ value: SecurityAlertRouteTarget; label: string }> = [
  { value: "default", label: "기본 채널 사용" },
  { value: "disabled", label: "전송 안 함" },
  { value: "telegram", label: "Telegram" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "email", label: "Email" },
];

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

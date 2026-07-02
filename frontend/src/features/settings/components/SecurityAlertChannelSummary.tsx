import type { SecurityAlertSettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";

type SecurityAlertProviderOption = (typeof SECURITY_ALERT_PROVIDER_OPTIONS)[number];

interface SecurityAlertChannelSummaryProps {
  settings?: SecurityAlertSettingsStatus;
  provider: SecurityAlertProviderOption;
}

export function SecurityAlertChannelSummary({
  settings,
  provider,
}: SecurityAlertChannelSummaryProps) {
  return (
    <>
      <SettingsSummaryRow label="상태" value={settings?.enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow
        label="운영 변경 알림"
        value={settings?.change_alerts_enabled ? "활성화" : "비활성화"}
      />
      <SettingsSummaryRow label="채널" value={provider.label} />
      <ProviderSummary settings={settings} />
      <SettingsSummaryRow label="포맷" value={provider.description} />
      <SettingsSummaryRow label="타임아웃" value={`${settings?.timeout_seconds ?? 5}초`} />
    </>
  );
}

function ProviderSummary({ settings }: { settings?: SecurityAlertSettingsStatus }) {
  if (settings?.provider === "telegram") {
    return (
      <>
        <SettingsSummaryRow
          label="Bot Token"
          value={settings.telegram_bot_token_configured ? "설정됨" : "(미설정)"}
        />
        <SettingsSummaryRow label="Chat ID" value={settings.telegram_chat_id || "(미설정)"} mono />
      </>
    );
  }

  if (settings?.provider === "email") {
    return (
      <>
        <SettingsSummaryRow
          label="SMTP"
          value={settings.email_host ? `${settings.email_host}:${settings.email_port}` : "(미설정)"}
          mono
        />
        <SettingsSummaryRow label="보안" value={settings.email_security} />
        <SettingsSummaryRow label="SMTP 계정" value={settings.email_username || "(미설정)"} mono />
        <SettingsSummaryRow
          label="비밀번호"
          value={settings.email_password_configured ? "설정됨" : "(미설정)"}
        />
        <SettingsSummaryRow label="From" value={settings.email_from || "(미설정)"} mono />
        <SettingsSummaryRow
          label="Recipients"
          value={settings.email_recipients.length > 0 ? settings.email_recipients.join(", ") : "(미설정)"}
          mono
        />
      </>
    );
  }

  if (settings?.provider === "pagerduty") {
    return (
      <SettingsSummaryRow
        label="Routing Key"
        value={settings.pagerduty_routing_key_configured ? "설정됨" : "(미설정)"}
      />
    );
  }

  return <SettingsSummaryRow label="Webhook URL" value={settings?.webhook_url || "(미설정)"} mono />;
}

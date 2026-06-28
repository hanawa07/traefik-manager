import { Cloud } from "lucide-react";

import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { SecurityAlertDeliveryHistory } from "@/features/settings/components/SecurityAlertDeliveryHistory";
import {
  CHANGE_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_PROVIDER_OPTIONS,
} from "@/features/settings/lib/settingsDefaults";
import { getSecurityAlertRouteLabel } from "@/features/settings/lib/settingsFormHelpers";

interface SecurityAlertSettingsSummaryProps {
  canManage: boolean;
  settings?: SecurityAlertSettingsStatus;
  provider: (typeof SECURITY_ALERT_PROVIDER_OPTIONS)[number];
  isTesting: boolean;
  isHistoryLoading: boolean;
  displayTimezone?: string;
  testResult: SettingsActionTestResult | null;
  securityRetryResult: SettingsActionTestResult | null;
  changeRetryResult: SettingsActionTestResult | null;
  securityTestHistory?: SettingsTestHistoryItem | null;
  securityDeliveryHistory?: SettingsTestHistoryItem | null;
  changeDeliveryHistory?: SettingsTestHistoryItem | null;
  isRetryingSecurityDelivery: boolean;
  isRetryingChangeDelivery: boolean;
  onTest: () => void;
  onRetrySecurityDelivery: () => void;
  onRetryChangeDelivery: () => void;
}

export function SecurityAlertSettingsSummary({
  canManage,
  settings,
  provider,
  isTesting,
  isHistoryLoading,
  displayTimezone,
  testResult,
  securityRetryResult,
  changeRetryResult,
  securityTestHistory,
  securityDeliveryHistory,
  changeDeliveryHistory,
  isRetryingSecurityDelivery,
  isRetryingChangeDelivery,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
}: SecurityAlertSettingsSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow label="상태" value={settings?.enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="운영 변경 알림" value={settings?.change_alerts_enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="채널" value={provider.label} />
      <ProviderSummary settings={settings} />
      <SettingsSummaryRow label="포맷" value={provider.description} />
      <SettingsSummaryRow label="전송 이벤트" value={(settings?.alert_events ?? []).join(", ")} />
      {SECURITY_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(settings?.event_routes?.[eventOption.key] ?? "default", provider.label)}
        />
      ))}
      {CHANGE_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-change-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(
            settings?.change_event_routes?.[eventOption.key] ?? "default",
            provider.label,
          )}
        />
      ))}
      <SettingsSummaryRow label="타임아웃" value={`${settings?.timeout_seconds ?? 5}초`} />
      {canManage ? (
        <SettingsActionRow>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
            onClick={onTest}
            disabled={isTesting}
          >
            <Cloud className="h-3.5 w-3.5" />
            {isTesting ? "전송 중..." : "테스트 알림 전송"}
          </button>
        </SettingsActionRow>
      ) : null}
      <p className="text-xs text-gray-500">테스트는 현재 저장된 기본 채널 설정 기준으로 즉시 전송됩니다.</p>
      <SecurityAlertDeliveryHistory
        isHistoryLoading={isHistoryLoading}
        displayTimezone={displayTimezone}
        testResult={testResult}
        securityRetryResult={securityRetryResult}
        changeRetryResult={changeRetryResult}
        securityTestHistory={securityTestHistory}
        securityDeliveryHistory={securityDeliveryHistory}
        changeDeliveryHistory={changeDeliveryHistory}
        isRetryingSecurityDelivery={isRetryingSecurityDelivery}
        isRetryingChangeDelivery={isRetryingChangeDelivery}
        onRetrySecurityDelivery={onRetrySecurityDelivery}
        onRetryChangeDelivery={onRetryChangeDelivery}
      />
      <p className="text-xs text-gray-500">
        알림 실패는 운영 가시성에만 영향을 주고, 로그인 차단/잠금 로직 자체는 중단하지 않습니다.
      </p>
    </SettingsSummary>
  );
}

function ProviderSummary({ settings }: { settings?: SecurityAlertSettingsStatus }) {
  if (settings?.provider === "telegram") {
    return (
      <>
        <SettingsSummaryRow label="Bot Token" value={settings.telegram_bot_token_configured ? "설정됨" : "(미설정)"} />
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
        <SettingsSummaryRow label="비밀번호" value={settings.email_password_configured ? "설정됨" : "(미설정)"} />
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

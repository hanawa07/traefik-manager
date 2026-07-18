import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";
import { SecurityAlertChannelSummary } from "./SecurityAlertChannelSummary";
import { SecurityAlertDeliverySummary } from "./SecurityAlertDeliverySummary";
import { SecurityAlertRoutingSummary } from "./SecurityAlertRoutingSummary";

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
  isRetryingDelivery: boolean;
  retryTargetAuditId: string | null;
  onTest: () => void;
  onRetrySecurityDelivery: (auditLogId?: string) => void;
  onRetryChangeDelivery: (auditLogId?: string) => void;
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
  isRetryingDelivery,
  retryTargetAuditId,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
}: SecurityAlertSettingsSummaryProps) {
  const retryDelayWarningMinutes = settings?.automatic_retry_delay_warning_minutes ?? 10;
  return (
    <SettingsSummary>
      <SecurityAlertChannelSummary settings={settings} provider={provider} />
      <SettingsSummaryRow
        label="자동 재시도 지연"
        value={
          <span
            data-retry-delay-warning-minutes={retryDelayWarningMinutes}
            data-testid="security-alert-retry-delay-summary"
          >
            {retryDelayWarningMinutes}분 초과
          </span>
        }
      />
      <SecurityAlertRoutingSummary settings={settings} providerLabel={provider.label} />
      <SecurityAlertDeliverySummary
        canManage={canManage}
        isHistoryLoading={isHistoryLoading}
        isTesting={isTesting}
        displayTimezone={displayTimezone}
        testResult={testResult}
        securityRetryResult={securityRetryResult}
        changeRetryResult={changeRetryResult}
        securityTestHistory={securityTestHistory}
        securityDeliveryHistory={securityDeliveryHistory}
        changeDeliveryHistory={changeDeliveryHistory}
        isRetryingDelivery={isRetryingDelivery}
        retryTargetAuditId={retryTargetAuditId}
        onTest={onTest}
        onRetrySecurityDelivery={onRetrySecurityDelivery}
        onRetryChangeDelivery={onRetryChangeDelivery}
      />
    </SettingsSummary>
  );
}

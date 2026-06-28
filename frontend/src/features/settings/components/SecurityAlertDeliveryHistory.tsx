import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  ActionResultNotice,
  SettingsTestHistoryNotice,
} from "@/features/settings/components/SettingsNotices";

interface SecurityAlertDeliveryHistoryProps {
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
  onRetrySecurityDelivery: () => void;
  onRetryChangeDelivery: () => void;
}

export function SecurityAlertDeliveryHistory({
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
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
}: SecurityAlertDeliveryHistoryProps) {
  return (
    <>
      {!isHistoryLoading ? (
        <div className="space-y-3">
          <SettingsTestHistoryNotice
            label="마지막 테스트 알림"
            history={securityTestHistory}
            timezone={displayTimezone}
          />
          <SettingsTestHistoryNotice
            label="최근 보안 이벤트 전송"
            history={securityDeliveryHistory}
            timezone={displayTimezone}
            onRetry={onRetrySecurityDelivery}
            isRetrying={isRetryingSecurityDelivery}
          />
          <SettingsTestHistoryNotice
            label="최근 운영 변경 전송"
            history={changeDeliveryHistory}
            timezone={displayTimezone}
            onRetry={onRetryChangeDelivery}
            isRetrying={isRetryingChangeDelivery}
          />
        </div>
      ) : null}
      <ActionResultNotice result={testResult} />
      <ActionResultNotice result={securityRetryResult} />
      <ActionResultNotice result={changeRetryResult} />
    </>
  );
}

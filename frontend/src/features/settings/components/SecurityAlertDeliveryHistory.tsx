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
  isRetryingDelivery: boolean;
  retryTargetAuditId: string | null;
  onRetrySecurityDelivery?: (auditLogId?: string) => void;
  onRetryChangeDelivery?: (auditLogId?: string) => void;
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
  isRetryingDelivery,
  retryTargetAuditId,
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
            isRetrying={isRetryingDelivery}
            retryingAuditId={retryTargetAuditId}
          />
          <SettingsTestHistoryNotice
            label="최근 운영 변경 전송"
            history={changeDeliveryHistory}
            timezone={displayTimezone}
            onRetry={onRetryChangeDelivery}
            isRetrying={isRetryingDelivery}
            retryingAuditId={retryTargetAuditId}
          />
        </div>
      ) : null}
      <ActionResultNotice result={testResult} />
      <ActionResultNotice result={securityRetryResult} />
      <ActionResultNotice result={changeRetryResult} />
    </>
  );
}

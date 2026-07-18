import { Cloud } from "lucide-react";

import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import { SecurityAlertDeliveryHistory } from "@/features/settings/components/SecurityAlertDeliveryHistory";
import { SecurityAlertFailureBanner } from "@/features/settings/components/SecurityAlertFailureBanner";

interface SecurityAlertDeliverySummaryProps {
  canManage: boolean;
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

export function SecurityAlertDeliverySummary({
  canManage,
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
}: SecurityAlertDeliverySummaryProps) {
  return (
    <>
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
      <p className="text-xs text-gray-500 dark:text-slate-400">테스트는 현재 저장된 기본 채널 설정 기준으로 즉시 전송됩니다.</p>
      <div className="space-y-2">
        <SecurityAlertFailureBanner
          label="보안 이벤트"
          history={securityDeliveryHistory}
          timezone={displayTimezone}
          isRetrying={isRetryingDelivery}
          retryTargetAuditId={retryTargetAuditId}
          onRetry={canManage ? onRetrySecurityDelivery : undefined}
        />
        <SecurityAlertFailureBanner
          label="운영 변경"
          history={changeDeliveryHistory}
          timezone={displayTimezone}
          isRetrying={isRetryingDelivery}
          retryTargetAuditId={retryTargetAuditId}
          onRetry={canManage ? onRetryChangeDelivery : undefined}
        />
      </div>
      <SecurityAlertDeliveryHistory
        isHistoryLoading={isHistoryLoading}
        displayTimezone={displayTimezone}
        testResult={testResult}
        securityRetryResult={securityRetryResult}
        changeRetryResult={changeRetryResult}
        securityTestHistory={securityTestHistory}
        securityDeliveryHistory={securityDeliveryHistory}
        changeDeliveryHistory={changeDeliveryHistory}
        isRetryingDelivery={isRetryingDelivery}
        retryTargetAuditId={retryTargetAuditId}
        onRetrySecurityDelivery={canManage ? onRetrySecurityDelivery : undefined}
        onRetryChangeDelivery={canManage ? onRetryChangeDelivery : undefined}
      />
      <p className="text-xs text-gray-500 dark:text-slate-400">
        알림 실패는 운영 가시성에만 영향을 주고, 로그인 차단/잠금 로직 자체는 중단하지 않습니다.
      </p>
    </>
  );
}

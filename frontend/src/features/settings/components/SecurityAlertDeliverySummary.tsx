import { Cloud } from "lucide-react";

import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import { SecurityAlertDeliveryHistory } from "@/features/settings/components/SecurityAlertDeliveryHistory";

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
  isRetryingSecurityDelivery: boolean;
  isRetryingChangeDelivery: boolean;
  onTest: () => void;
  onRetrySecurityDelivery: () => void;
  onRetryChangeDelivery: () => void;
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
  isRetryingSecurityDelivery,
  isRetryingChangeDelivery,
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
    </>
  );
}

import { useState } from "react";

import { useAuditRetryDelivery } from "@/features/audit/hooks/useAudit";
import type {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
  SettingsTestHistoryStatus,
} from "@/features/settings/api/settingsApi";
import { buildActionFailure, getApiErrorDetail } from "@/features/settings/lib/settingsErrors";

type AlertRetryTarget = "security" | "change";

export function useSettingsAlertRetry(settingsTestHistory?: SettingsTestHistoryStatus) {
  const [securityAlertDeliveryRetryResult, setSecurityAlertDeliveryRetryResult] =
    useState<SettingsActionTestResult | null>(null);
  const [changeAlertDeliveryRetryResult, setChangeAlertDeliveryRetryResult] =
    useState<SettingsActionTestResult | null>(null);
  const [retryTargetAuditId, setRetryTargetAuditId] = useState<string | null>(null);
  const retryDelivery = useAuditRetryDelivery();

  const handleRetryDelivery = async (
    history: SettingsTestHistoryItem | null | undefined,
    target: AlertRetryTarget,
  ) => {
    const auditLogId = history?.last_failure_audit_id;
    if (!auditLogId) return;

    try {
      setRetryTargetAuditId(auditLogId);
      const result = await retryDelivery.mutateAsync({ auditLogId });
      const notice = {
        success: result.success,
        message: result.message,
        detail: result.detail,
        provider: result.provider,
      };
      if (target === "security") {
        setSecurityAlertDeliveryRetryResult(notice);
      } else {
        setChangeAlertDeliveryRetryResult(notice);
      }
    } catch (error) {
      const notice = buildActionFailure(
        "알림 전송 재시도에 실패했습니다",
        getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다"),
      );
      if (target === "security") {
        setSecurityAlertDeliveryRetryResult(notice);
      } else {
        setChangeAlertDeliveryRetryResult(notice);
      }
    } finally {
      setRetryTargetAuditId(null);
    }
  };

  return {
    securityAlertDeliveryRetryResult,
    changeAlertDeliveryRetryResult,
    isRetryingSecurityDelivery:
      retryDelivery.isPending &&
      retryTargetAuditId === settingsTestHistory?.security_alert_delivery?.last_failure_audit_id,
    isRetryingChangeDelivery:
      retryDelivery.isPending &&
      retryTargetAuditId === settingsTestHistory?.change_alert_delivery?.last_failure_audit_id,
    retrySecurityDelivery: () => handleRetryDelivery(settingsTestHistory?.security_alert_delivery, "security"),
    retryChangeDelivery: () => handleRetryDelivery(settingsTestHistory?.change_alert_delivery, "change"),
  };
}

import { useState } from "react";

import { useAuditRetryDelivery } from "@/features/audit/hooks/useAudit";
import type {
  SettingsActionTestResult,
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
    auditLogId: string | null | undefined,
    target: AlertRetryTarget,
  ) => {
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
    isRetryingDelivery: retryDelivery.isPending,
    retryTargetAuditId,
    retrySecurityDelivery: (auditLogId?: string) => handleRetryDelivery(
      auditLogId ?? settingsTestHistory?.security_alert_delivery?.last_failure_audit_id,
      "security",
    ),
    retryChangeDelivery: (auditLogId?: string) => handleRetryDelivery(
      auditLogId ?? settingsTestHistory?.change_alert_delivery?.last_failure_audit_id,
      "change",
    ),
  };
}

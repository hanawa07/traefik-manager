import { useState } from "react";

import { useAuditRetryDelivery, useAuditRollback } from "@/features/audit/hooks/useAudit";

import type { RollbackResourceType } from "./auditPageHelpers";

interface AuditFeedback {
  type: "success" | "error";
  text: string;
}

export function useAuditLogActions() {
  const [rollbackFeedback, setRollbackFeedback] = useState<AuditFeedback | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<AuditFeedback | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);
  const [retryTargetId, setRetryTargetId] = useState<string | null>(null);
  const rollbackMutation = useAuditRollback();
  const retryDeliveryMutation = useAuditRetryDelivery();

  const handleRollback = async (resourceType: RollbackResourceType, auditLogId: string) => {
    try {
      setRollbackTargetId(auditLogId);
      setRollbackFeedback(null);
      const result = await rollbackMutation.mutateAsync({ resourceType, auditLogId });
      const message =
        typeof result.message === "string" ? result.message : "대상 항목을 이전 상태로 되돌렸습니다.";
      setRollbackFeedback({ type: "success", text: message });
    } catch (rollbackError) {
      setRollbackFeedback({
        type: "error",
        text: extractApiErrorMessage(rollbackError, "롤백에 실패했습니다."),
      });
    } finally {
      setRollbackTargetId(null);
    }
  };

  const handleRetryDelivery = async (auditLogId: string) => {
    try {
      setRetryTargetId(auditLogId);
      setDeliveryFeedback(null);
      const result = await retryDeliveryMutation.mutateAsync({ auditLogId });
      setDeliveryFeedback({
        type: result.success ? "success" : "error",
        text: result.detail ? `${result.message} (${result.detail})` : result.message,
      });
    } catch (retryError) {
      setDeliveryFeedback({
        type: "error",
        text: extractApiErrorMessage(retryError, "알림 재시도에 실패했습니다."),
      });
    } finally {
      setRetryTargetId(null);
    }
  };

  return {
    deliveryFeedback,
    isRetryPending: retryDeliveryMutation.isPending,
    isRollbackPending: rollbackMutation.isPending,
    retryTargetId,
    rollbackFeedback,
    rollbackTargetId,
    onRetryDelivery: handleRetryDelivery,
    onRollback: handleRollback,
  };
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

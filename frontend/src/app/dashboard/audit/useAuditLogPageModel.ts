"use client";

import { useState } from "react";

import { useAudit, useAuditRetryDelivery, useAuditRollback } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

import {
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type RollbackResourceType,
} from "./auditPageHelpers";
import { buildAuditLogQuery } from "./auditPageQuery";

interface AuditFeedback {
  type: "success" | "error";
  text: string;
}

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>("all");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatusKey>("all");
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] =
    useState<DeliveryProviderKey>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [rollbackFeedback, setRollbackFeedback] = useState<AuditFeedback | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<AuditFeedback | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);
  const [retryTargetId, setRetryTargetId] = useState<string | null>(null);

  const auditQuery = buildAuditLogQuery({
    selectedDeliveryProvider,
    selectedDeliveryStatus,
    selectedFilter,
  });
  const { data: logs, isLoading, isError, error } = useAudit(auditQuery);
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
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
    errorMessage: error instanceof Error ? error.message : FALLBACK_AUDIT_LOAD_ERROR,
    filters: {
      selectedDeliveryProvider,
      selectedDeliveryStatus,
      selectedFilter,
      onDeliveryProviderChange: setSelectedDeliveryProvider,
      onDeliveryStatusChange: setSelectedDeliveryStatus,
      onFilterChange: setSelectedFilter,
    },
    isError,
    isLoading,
    rollbackFeedback,
    table: {
      expandedLogId,
      isRetryPending: retryDeliveryMutation.isPending,
      isRollbackPending: rollbackMutation.isPending,
      logs,
      retryTargetId,
      rollbackTargetId,
      timezone: timeDisplaySettings?.display_timezone,
      onExpandedLogChange: setExpandedLogId,
      onRetryDelivery: handleRetryDelivery,
      onRollback: handleRollback,
    },
  };
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

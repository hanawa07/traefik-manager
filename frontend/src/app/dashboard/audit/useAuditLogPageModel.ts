"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAudit, useManagerHealthSummary } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

import {
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
  isAuditFilterKey,
} from "./auditPageHelpers";
import { useAuditLogActions } from "./useAuditLogActions";
import { buildAuditLogQuery } from "./auditPageQuery";

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const requestedFilter = useSearchParams().get("filter");
  const initialFilter = isAuditFilterKey(requestedFilter) ? requestedFilter : "all";
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>(initialFilter);
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatusKey>("all");
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] =
    useState<DeliveryProviderKey>("all");
  const [managerHealthWindowMinutes, setManagerHealthWindowMinutes] =
    useState<ManagerHealthWindowMinutes>(10080);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const auditQuery = buildAuditLogQuery({
    selectedDeliveryProvider,
    selectedDeliveryStatus,
    selectedFilter,
  });
  const { data: logs, isLoading, isError, error } = useAudit(auditQuery);
  const { data: managerHealthSummary } = useManagerHealthSummary(managerHealthWindowMinutes);
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const auditActions = useAuditLogActions();

  return {
    deliveryFeedback: auditActions.deliveryFeedback,
    errorMessage: error instanceof Error ? error.message : FALLBACK_AUDIT_LOAD_ERROR,
    filters: {
      selectedDeliveryProvider,
      selectedDeliveryStatus,
      selectedFilter,
      managerHealthCounts: managerHealthSummary
        ? {
            unhealthy: managerHealthSummary.unhealthy_count,
            recovered: managerHealthSummary.recovered_count,
          }
        : undefined,
      managerHealthWindowMinutes,
      onDeliveryProviderChange: setSelectedDeliveryProvider,
      onDeliveryStatusChange: setSelectedDeliveryStatus,
      onFilterChange: setSelectedFilter,
      onManagerHealthWindowChange: setManagerHealthWindowMinutes,
    },
    isError,
    isLoading,
    rollbackFeedback: auditActions.rollbackFeedback,
    table: {
      expandedLogId,
      isRetryPending: auditActions.isRetryPending,
      isRollbackPending: auditActions.isRollbackPending,
      logs,
      retryTargetId: auditActions.retryTargetId,
      rollbackTargetId: auditActions.rollbackTargetId,
      timezone: timeDisplaySettings?.display_timezone,
      onExpandedLogChange: setExpandedLogId,
      onRetryDelivery: auditActions.onRetryDelivery,
      onRollback: auditActions.onRollback,
    },
  };
}

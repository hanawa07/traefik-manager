"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import type { AuditLogItem } from "@/features/audit/api/auditApi";
import { useAudit, useManagerHealthAudit } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

import {
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
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
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const auditQuery = buildAuditLogQuery({
    selectedDeliveryProvider,
    selectedDeliveryStatus,
    selectedFilter,
  });
  const { data: logs, isLoading, isError, error } = useAudit(auditQuery);
  const { data: managerHealthLogs } = useManagerHealthAudit(100);
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const auditActions = useAuditLogActions();

  return {
    deliveryFeedback: auditActions.deliveryFeedback,
    errorMessage: error instanceof Error ? error.message : FALLBACK_AUDIT_LOAD_ERROR,
    filters: {
      selectedDeliveryProvider,
      selectedDeliveryStatus,
      selectedFilter,
      managerHealthCounts: managerHealthLogs
        ? countManagerHealthEvents(managerHealthLogs)
        : undefined,
      onDeliveryProviderChange: setSelectedDeliveryProvider,
      onDeliveryStatusChange: setSelectedDeliveryStatus,
      onFilterChange: setSelectedFilter,
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

function countManagerHealthEvents(logs: AuditLogItem[]) {
  const counts = { unhealthy: 0, recovered: 0 };
  for (const log of logs) {
    if (log.event === "manager_docker_unhealthy") counts.unhealthy += 1;
    if (log.event === "manager_docker_recovered") counts.recovered += 1;
  }
  return counts;
}

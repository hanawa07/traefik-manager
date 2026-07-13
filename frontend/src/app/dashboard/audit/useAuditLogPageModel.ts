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
  isDeliveryProviderKey,
  isDeliveryStatusKey,
  parseManagerHealthWindowMinutes,
} from "./auditPageHelpers";
import { useAuditLogActions } from "./useAuditLogActions";
import { buildAuditLogQuery } from "./auditPageQuery";

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const initialFilter = isAuditFilterKey(requestedFilter) ? requestedFilter : "all";
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>(initialFilter);
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatusKey>(() => {
    const value = searchParams.get("delivery_status");
    return isDeliveryStatusKey(value) ? value : "all";
  });
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] =
    useState<DeliveryProviderKey>(() => {
      const value = searchParams.get("delivery_provider");
      return isDeliveryProviderKey(value) ? value : "all";
    });
  const [managerHealthWindowMinutes, setManagerHealthWindowMinutes] =
    useState<ManagerHealthWindowMinutes>(() =>
      parseManagerHealthWindowMinutes(searchParams.get("manager_window")),
    );
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

  const handleFilterChange = (filter: AuditFilterKey) => {
    setSelectedFilter(filter);
    replaceAuditQueryParam("filter", filter, "all");
  };
  const handleDeliveryStatusChange = (status: DeliveryStatusKey) => {
    setSelectedDeliveryStatus(status);
    replaceAuditQueryParam("delivery_status", status, "all");
  };
  const handleDeliveryProviderChange = (provider: DeliveryProviderKey) => {
    setSelectedDeliveryProvider(provider);
    replaceAuditQueryParam("delivery_provider", provider, "all");
  };
  const handleManagerHealthWindowChange = (minutes: ManagerHealthWindowMinutes) => {
    setManagerHealthWindowMinutes(minutes);
    replaceAuditQueryParam("manager_window", String(minutes), "10080");
  };

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
            docker:
              managerHealthSummary.docker_unhealthy_count +
              managerHealthSummary.docker_recovered_count,
            watchdog:
              managerHealthSummary.watchdog_unhealthy_count +
              managerHealthSummary.watchdog_recovered_count,
          }
        : undefined,
      managerHealthWindowMinutes,
      onDeliveryProviderChange: handleDeliveryProviderChange,
      onDeliveryStatusChange: handleDeliveryStatusChange,
      onFilterChange: handleFilterChange,
      onManagerHealthWindowChange: handleManagerHealthWindowChange,
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

function replaceAuditQueryParam(key: string, value: string, defaultValue: string) {
  const params = new URLSearchParams(window.location.search);
  if (value === defaultValue) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

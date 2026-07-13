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
  type ManagerSourceKey,
  type ManagerStatusKey,
  isAuditFilterKey,
  isDeliveryProviderKey,
  isDeliveryStatusKey,
  isManagerSourceKey,
  isManagerStatusKey,
  parseManagerHealthWindowMinutes,
} from "./auditPageHelpers";
import { useAuditLogActions } from "./useAuditLogActions";
import { buildAuditLogQuery } from "./auditPageQuery";

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const initialFilter = isAuditFilterKey(requestedFilter)
    ? requestedFilter
    : isLegacyManagerFilter(requestedFilter)
      ? "manager_health"
      : "all";
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>(initialFilter);
  const [selectedManagerSource, setSelectedManagerSource] = useState<ManagerSourceKey>(() => {
    const value = searchParams.get("manager_source");
    if (isManagerSourceKey(value)) return value;
    return requestedFilter === "manager_docker"
      ? "docker"
      : requestedFilter === "manager_watchdog"
        ? "watchdog"
        : "all";
  });
  const [selectedManagerStatus, setSelectedManagerStatus] = useState<ManagerStatusKey>(() => {
    const value = searchParams.get("manager_status");
    if (isManagerStatusKey(value)) return value;
    return requestedFilter === "manager_unhealthy"
      ? "unhealthy"
      : requestedFilter === "manager_recovered"
        ? "recovered"
        : "all";
  });
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
    selectedManagerSource,
    selectedManagerStatus,
  });
  const { data: logs, isLoading, isFetching, isError, error } = useAudit(auditQuery);
  const { data: managerHealthSummary } = useManagerHealthSummary(managerHealthWindowMinutes);
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const auditActions = useAuditLogActions();

  const handleFilterChange = (filter: AuditFilterKey) => {
    setSelectedFilter(filter);
    if (filter !== "manager_health") {
      setSelectedManagerSource("all");
      setSelectedManagerStatus("all");
    }
    replaceAuditQueryParams([
      ["filter", filter, "all"],
      ["manager_source", filter === "manager_health" ? selectedManagerSource : "all", "all"],
      ["manager_status", filter === "manager_health" ? selectedManagerStatus : "all", "all"],
    ]);
  };
  const handleManagerSourceChange = (source: ManagerSourceKey) => {
    setSelectedFilter("manager_health");
    setSelectedManagerSource(source);
    replaceAuditQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_source", source, "all"],
    ]);
  };
  const handleManagerStatusChange = (status: ManagerStatusKey) => {
    setSelectedFilter("manager_health");
    setSelectedManagerStatus(status);
    replaceAuditQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_status", status, "all"],
    ]);
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
      selectedManagerSource,
      selectedManagerStatus,
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
      onManagerSourceChange: handleManagerSourceChange,
      onManagerStatusChange: handleManagerStatusChange,
      onManagerHealthWindowChange: handleManagerHealthWindowChange,
    },
    isError,
    isLoading,
    rollbackFeedback: auditActions.rollbackFeedback,
    table: {
      expandedLogId,
      isRetryPending: auditActions.isRetryPending,
      isRefreshing: isFetching && !isLoading,
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

function isLegacyManagerFilter(value: string | null) {
  return ["manager_docker", "manager_watchdog", "manager_unhealthy", "manager_recovered"].includes(
    value || "",
  );
}

function replaceAuditQueryParam(key: string, value: string, defaultValue: string) {
  replaceAuditQueryParams([[key, value, defaultValue]]);
}

function replaceAuditQueryParams(values: [key: string, value: string, defaultValue: string][]) {
  const params = new URLSearchParams(window.location.search);
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

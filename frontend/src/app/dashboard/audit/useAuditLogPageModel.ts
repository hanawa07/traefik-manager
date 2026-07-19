"use client";

import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { buildAuditExportUrl, type AuditLogItem } from "@/features/audit/api/auditApi";
import { useAuditPage, useManagerHealthSummary } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

import {
  type AuditFilterKey,
  type AuditPeriodDays,
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
  isManagerHttpErrorEvent,
  isManagerHttpLogStorageEvent,
  parseAuditDate,
  parseAuditPeriodDays,
  parseManagerHealthWindowMinutes,
} from "./auditPageHelpers";
import { useAuditLogActions } from "./useAuditLogActions";
import {
  AUDIT_PAGE_SIZE,
  buildAuditLogQuery,
  parseAuditPageSize,
  type AuditPageSize,
  withoutAuditPagination,
} from "./auditPageQuery";

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const initialFilter = isAuditFilterKey(requestedFilter)
    ? requestedFilter
    : isLegacyManagerFilter(requestedFilter)
      ? "manager_health"
      : "all";
  const initialStartDate = parseAuditDate(searchParams.get("start_date"));
  const initialEndDate = parseAuditDate(searchParams.get("end_date"));
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>(initialFilter);
  const [searchText, setSearchText] = useState(() =>
    (searchParams.get("q") || "").slice(0, 100),
  );
  const [currentPage, setCurrentPage] = useState(() => parseAuditPage(searchParams.get("page")));
  const [pageSize, setPageSize] = useState<AuditPageSize>(() =>
    parseAuditPageSize(searchParams.get("page_size")),
  );
  const [selectedPeriod, setSelectedPeriod] = useState<AuditPeriodDays>(() =>
    initialStartDate || initialEndDate ? "all" : parseAuditPeriodDays(searchParams.get("period")),
  );
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
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
  const [expandedLogId, setExpandedLogId] = useState<string | null | undefined>(undefined);
  const deferredSearchText = useDeferredValue(searchText.trim());

  const auditQuery = buildAuditLogQuery({
    endDate,
    selectedDeliveryProvider,
    selectedDeliveryStatus,
    selectedFilter,
    selectedManagerSource,
    selectedManagerStatus,
    selectedPeriod,
    startDate,
    searchText: deferredSearchText,
    page: currentPage,
    pageSize,
  });
  const exportUrl = buildAuditExportUrl(withoutAuditPagination(auditQuery));
  const { data: logPage, isLoading, isFetching, isError, error } = useAuditPage(auditQuery);
  const { data: delayedRetryPage } = useAuditPage({ limit: 1, offset: 0, retry_delay: "delayed" });
  const { data: managerHealthSummary } = useManagerHealthSummary(managerHealthWindowMinutes);
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const auditActions = useAuditLogActions();
  const requestedExpandedLogId = searchParams.get("expand");
  const autoExpandedLogId =
    requestedExpandedLogId === "latest"
      ? logPage?.items.find(isManagerHttpLog)?.id
      : requestedExpandedLogId;
  const visibleExpandedLogId = expandedLogId === undefined ? autoExpandedLogId ?? null : expandedLogId;

  const replaceFilterQueryParams = (
    values: [key: string, value: string, defaultValue: string][],
  ) => {
    setCurrentPage(1);
    setExpandedLogId(null);
    replaceAuditQueryParams([...values, ["page", "1", "1"]]);
  };
  const handleFilterChange = (filter: AuditFilterKey) => {
    setSelectedFilter(filter);
    if (filter !== "manager_health") {
      setSelectedManagerSource("all");
      setSelectedManagerStatus("all");
    }
    replaceFilterQueryParams([
      ["filter", filter, "all"],
      ["manager_source", filter === "manager_health" ? selectedManagerSource : "all", "all"],
      ["manager_status", filter === "manager_health" ? selectedManagerStatus : "all", "all"],
    ]);
  };
  const handleManagerSourceChange = (source: ManagerSourceKey) => {
    setSelectedFilter("manager_health");
    setSelectedManagerSource(source);
    replaceFilterQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_source", source, "all"],
    ]);
  };
  const handleManagerStatusChange = (status: ManagerStatusKey) => {
    setSelectedFilter("manager_health");
    setSelectedManagerStatus(status);
    replaceFilterQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_status", status, "all"],
    ]);
  };
  const handleDeliveryStatusChange = (status: DeliveryStatusKey) => {
    setSelectedDeliveryStatus(status);
    replaceFilterQueryParams([["delivery_status", status, "all"]]);
  };
  const handleDeliveryProviderChange = (provider: DeliveryProviderKey) => {
    setSelectedDeliveryProvider(provider);
    replaceFilterQueryParams([["delivery_provider", provider, "all"]]);
  };
  const handleManagerHealthWindowChange = (minutes: ManagerHealthWindowMinutes) => {
    setManagerHealthWindowMinutes(minutes);
    replaceFilterQueryParams([["manager_window", String(minutes), "10080"]]);
  };
  const handleSearchTextChange = (value: string) => {
    const nextValue = value.slice(0, 100);
    setSearchText(nextValue);
    replaceFilterQueryParams([["q", nextValue, ""]]);
  };
  const handlePeriodChange = (period: AuditPeriodDays) => {
    setSelectedPeriod(period);
    setStartDate("");
    setEndDate("");
    replaceFilterQueryParams([
      ["period", String(period), "all"],
      ["start_date", "", ""],
      ["end_date", "", ""],
    ]);
  };
  const handleDateRangeChange = (start: string, end: string) => {
    if (start && end && start > end) return;
    setStartDate(start);
    setEndDate(end);
    setSelectedPeriod("all");
    replaceFilterQueryParams([
      ["start_date", start, ""],
      ["end_date", end, ""],
      ["period", "all", "all"],
    ]);
  };
  const handlePageSizeChange = (nextPageSize: AuditPageSize) => {
    setPageSize(nextPageSize);
    replaceFilterQueryParams([["page_size", String(nextPageSize), String(AUDIT_PAGE_SIZE)]]);
  };
  const handleResetFilters = () => {
    setSelectedFilter("all");
    setSelectedManagerSource("all");
    setSelectedManagerStatus("all");
    setSelectedDeliveryStatus("all");
    setSelectedDeliveryProvider("all");
    setManagerHealthWindowMinutes(10080);
    setSelectedPeriod("all");
    setStartDate("");
    setEndDate("");
    setPageSize(AUDIT_PAGE_SIZE);
    setSearchText("");
    setCurrentPage(1);
    setExpandedLogId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedLogId(null);
    replaceAuditQueryParam("page", String(page), "1");
  };

  return {
    deliveryFeedback: auditActions.deliveryFeedback,
    errorMessage: error instanceof Error ? error.message : FALLBACK_AUDIT_LOAD_ERROR,
    exportUrl,
    filters: {
      selectedDeliveryProvider,
      selectedDeliveryStatus,
      delayedRetryCount: delayedRetryPage?.total,
      selectedFilter,
      selectedManagerSource,
      selectedManagerStatus,
      selectedPeriod,
      startDate,
      endDate,
      searchText,
      managerHealthCounts: managerHealthSummary,
      managerHealthWindowMinutes,
      onDeliveryProviderChange: handleDeliveryProviderChange,
      onDeliveryStatusChange: handleDeliveryStatusChange,
      onFilterChange: handleFilterChange,
      onManagerSourceChange: handleManagerSourceChange,
      onManagerStatusChange: handleManagerStatusChange,
      onManagerHealthWindowChange: handleManagerHealthWindowChange,
      onDateRangeChange: handleDateRangeChange,
      onPeriodChange: handlePeriodChange,
      onResetFilters: handleResetFilters,
      onSearchTextChange: handleSearchTextChange,
    },
    isError,
    isLoading,
    rollbackFeedback: auditActions.rollbackFeedback,
    table: {
      currentPage,
      expandedLogId: visibleExpandedLogId,
      isRetryPending: auditActions.isRetryPending,
      isRefreshing: isFetching && !isLoading,
      isRollbackPending: auditActions.isRollbackPending,
      logs: logPage?.items,
      pageSize,
      retryTargetId: auditActions.retryTargetId,
      rollbackTargetId: auditActions.rollbackTargetId,
      timezone: timeDisplaySettings?.display_timezone,
      totalCount: logPage?.total || 0,
      onExpandedLogChange: setExpandedLogId,
      onRetryDelivery: auditActions.onRetryDelivery,
      onRollback: auditActions.onRollback,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
    },
  };
}

function isManagerHttpLog(log: AuditLogItem) {
  return (
    isManagerHttpErrorEvent(log.event) ||
    isManagerHttpErrorEvent(log.detail?.event) ||
    isManagerHttpLogStorageEvent(log.event) ||
    isManagerHttpLogStorageEvent(log.detail?.event)
  );
}

function parseAuditPage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
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

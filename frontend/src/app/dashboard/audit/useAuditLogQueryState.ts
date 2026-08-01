"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

import {
  type AuditBulkNotificationStatus,
  type AuditBulkPeriod,
  type AuditFilterKey,
  type AuditPeriodDays,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
  type ManagerSourceKey,
  type ManagerStatusKey,
} from "./auditPageHelpers";
import {
  AUDIT_PAGE_SIZE,
  buildAuditLogQuery,
  type AuditPageSize,
} from "./auditPageQuery";
import {
  buildAuditQueryUrl,
  decodeAuditLogQuery,
  type AuditQueryParamUpdate,
} from "./auditLogQueryCodec";

export function useAuditLogQueryState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = decodeAuditLogQuery(searchParams);
  const [expandedLogId, setExpandedLogId] = useState<string | null | undefined>(undefined);
  const deferredSearchText = useDeferredValue(query.searchText.trim());
  const replaceQueryParams = (values: AuditQueryParamUpdate[], reset = false) => {
    router.replace(
      buildAuditQueryUrl(window.location.pathname, window.location.search, values, reset),
      { scroll: false },
    );
  };

  const replaceFilterQueryParams = (values: AuditQueryParamUpdate[]) => {
    setExpandedLogId(null);
    replaceQueryParams([...values, ["page", "1", "1"]]);
  };
  const handleFilterChange = (filter: AuditFilterKey) => {
    replaceFilterQueryParams([
      ["filter", filter, "all"],
      ["manager_source", filter === "manager_health" ? query.selectedManagerSource : "all", "all"],
      ["manager_status", filter === "manager_health" ? query.selectedManagerStatus : "all", "all"],
    ]);
  };
  const handleManagerSourceChange = (source: ManagerSourceKey) => {
    replaceFilterQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_source", source, "all"],
    ]);
  };
  const handleManagerStatusChange = (status: ManagerStatusKey) => {
    replaceFilterQueryParams([
      ["filter", "manager_health", "all"],
      ["manager_status", status, "all"],
    ]);
  };
  const handleDeliveryStatusChange = (status: DeliveryStatusKey) => {
    replaceFilterQueryParams([["delivery_status", status, "all"]]);
  };
  const handleDeliveryProviderChange = (provider: DeliveryProviderKey) => {
    replaceFilterQueryParams([["delivery_provider", provider, "all"]]);
  };
  const handleBulkPeriodChange = (period: AuditBulkPeriod) => {
    replaceQueryParams([
      ["bulk_period", period, "all"],
      ["bulk_page", "1", "1"],
    ]);
  };
  const handleBulkNotificationStatusChange = (status: AuditBulkNotificationStatus) => {
    replaceQueryParams([
      ["bulk_status", status, "all"],
      ["bulk_page", "1", "1"],
    ]);
  };
  const handleBulkPageChange = (page: number) => {
    replaceQueryParams([["bulk_page", String(page), "1"]]);
  };
  const handleManagerHealthWindowChange = (minutes: ManagerHealthWindowMinutes) => {
    replaceFilterQueryParams([["manager_window", String(minutes), "10080"]]);
  };
  const handleSearchTextChange = (value: string) => {
    replaceFilterQueryParams([["q", value.slice(0, 100), ""]]);
  };
  const handlePeriodChange = (period: AuditPeriodDays) => {
    replaceFilterQueryParams([
      ["period", String(period), "all"],
      ["start_date", "", ""],
      ["end_date", "", ""],
    ]);
  };
  const handleDateRangeChange = (start: string, end: string) => {
    if (start && end && start > end) return;
    replaceFilterQueryParams([
      ["start_date", start, ""],
      ["end_date", end, ""],
      ["period", "all", "all"],
    ]);
  };
  const handlePageSizeChange = (pageSize: AuditPageSize) => {
    replaceFilterQueryParams([["page_size", String(pageSize), String(AUDIT_PAGE_SIZE)]]);
  };
  const handleResetFilters = () => {
    setExpandedLogId(null);
    replaceQueryParams([], true);
  };
  const handleDelayedRetryPeriodChange = (period: 1 | 7 | 30) => {
    setExpandedLogId(null);
    replaceQueryParams([
      ["filter", "delayed_retry", "all"],
      ["period", String(period), "all"],
    ], true);
  };
  const handlePageChange = (page: number) => {
    setExpandedLogId(null);
    replaceQueryParams([["page", String(page), "1"]]);
  };

  return {
    auditQuery: buildAuditLogQuery({
      endDate: query.endDate,
      selectedDeliveryProvider: query.selectedDeliveryProvider,
      selectedDeliveryStatus: query.selectedDeliveryStatus,
      selectedFilter: query.selectedFilter,
      selectedManagerSource: query.selectedManagerSource,
      selectedManagerStatus: query.selectedManagerStatus,
      selectedPeriod: query.selectedPeriod,
      startDate: query.startDate,
      searchText: deferredSearchText,
      page: query.currentPage,
      pageSize: query.pageSize,
    }),
    bulkOperations: {
      notificationStatus: query.selectedBulkNotificationStatus,
      page: query.bulkPage,
      period: query.selectedBulkPeriod,
      onNotificationStatusChange: handleBulkNotificationStatusChange,
      onPageChange: handleBulkPageChange,
      onPeriodChange: handleBulkPeriodChange,
    },
    filters: {
      selectedDeliveryProvider: query.selectedDeliveryProvider,
      selectedDeliveryStatus: query.selectedDeliveryStatus,
      selectedBulkNotificationStatus: query.selectedBulkNotificationStatus,
      selectedBulkPeriod: query.selectedBulkPeriod,
      selectedFilter: query.selectedFilter,
      selectedManagerSource: query.selectedManagerSource,
      selectedManagerStatus: query.selectedManagerStatus,
      selectedPeriod: query.selectedPeriod,
      startDate: query.startDate,
      endDate: query.endDate,
      searchText: query.searchText,
      managerHealthWindowMinutes: query.managerHealthWindowMinutes,
      onDeliveryProviderChange: handleDeliveryProviderChange,
      onDeliveryStatusChange: handleDeliveryStatusChange,
      onBulkNotificationStatusChange: handleBulkNotificationStatusChange,
      onBulkPeriodChange: handleBulkPeriodChange,
      onFilterChange: handleFilterChange,
      onManagerSourceChange: handleManagerSourceChange,
      onManagerStatusChange: handleManagerStatusChange,
      onManagerHealthWindowChange: handleManagerHealthWindowChange,
      onDateRangeChange: handleDateRangeChange,
      onPeriodChange: handlePeriodChange,
      onResetFilters: handleResetFilters,
      onSearchTextChange: handleSearchTextChange,
    },
    requestedExpandedLogId: query.requestedExpandedLogId,
    table: {
      currentPage: query.currentPage,
      expandedLogId,
      pageSize: query.pageSize,
      onExpandedLogChange: setExpandedLogId,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
    },
    trend: {
      selectedPeriod: query.selectedFilter === "delayed_retry" ? query.selectedPeriod : null,
      onSelectPeriod: handleDelayedRetryPeriodChange,
    },
  };
}

"use client";

import { useSearchParams } from "next/navigation";
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
  clearAuditQuery,
  decodeAuditLogQuery,
  replaceAuditQueryParam,
  replaceAuditQueryParams,
} from "./auditLogQueryCodec";

export function useAuditLogQueryState() {
  const searchParams = useSearchParams();
  const decodedQuery = decodeAuditLogQuery(searchParams);
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>(decodedQuery.selectedFilter);
  const [searchText, setSearchText] = useState(decodedQuery.searchText);
  const [currentPage, setCurrentPage] = useState(decodedQuery.currentPage);
  const [pageSize, setPageSize] = useState<AuditPageSize>(decodedQuery.pageSize);
  const [selectedPeriod, setSelectedPeriod] = useState<AuditPeriodDays>(decodedQuery.selectedPeriod);
  const [startDate, setStartDate] = useState(decodedQuery.startDate);
  const [endDate, setEndDate] = useState(decodedQuery.endDate);
  const [selectedManagerSource, setSelectedManagerSource] =
    useState<ManagerSourceKey>(decodedQuery.selectedManagerSource);
  const [selectedManagerStatus, setSelectedManagerStatus] =
    useState<ManagerStatusKey>(decodedQuery.selectedManagerStatus);
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] =
    useState<DeliveryStatusKey>(decodedQuery.selectedDeliveryStatus);
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] =
    useState<DeliveryProviderKey>(decodedQuery.selectedDeliveryProvider);
  const [selectedBulkPeriod, setSelectedBulkPeriod] =
    useState<AuditBulkPeriod>(decodedQuery.selectedBulkPeriod);
  const [selectedBulkNotificationStatus, setSelectedBulkNotificationStatus] =
    useState<AuditBulkNotificationStatus>(decodedQuery.selectedBulkNotificationStatus);
  const [bulkPage, setBulkPage] = useState(decodedQuery.bulkPage);
  const [managerHealthWindowMinutes, setManagerHealthWindowMinutes] =
    useState<ManagerHealthWindowMinutes>(decodedQuery.managerHealthWindowMinutes);
  const [expandedLogId, setExpandedLogId] = useState<string | null | undefined>(undefined);
  const deferredSearchText = useDeferredValue(searchText.trim());

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
  const handleBulkPeriodChange = (period: AuditBulkPeriod) => {
    setSelectedBulkPeriod(period);
    setBulkPage(1);
    replaceAuditQueryParams([
      ["bulk_period", period, "all"],
      ["bulk_page", "1", "1"],
    ]);
  };
  const handleBulkNotificationStatusChange = (status: AuditBulkNotificationStatus) => {
    setSelectedBulkNotificationStatus(status);
    setBulkPage(1);
    replaceAuditQueryParams([
      ["bulk_status", status, "all"],
      ["bulk_page", "1", "1"],
    ]);
  };
  const handleBulkPageChange = (page: number) => {
    setBulkPage(page);
    replaceAuditQueryParam("bulk_page", String(page), "1");
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
    setSelectedBulkPeriod("all");
    setSelectedBulkNotificationStatus("all");
    setBulkPage(1);
    setManagerHealthWindowMinutes(10080);
    setSelectedPeriod("all");
    setStartDate("");
    setEndDate("");
    setPageSize(AUDIT_PAGE_SIZE);
    setSearchText("");
    setCurrentPage(1);
    setExpandedLogId(null);
    clearAuditQuery();
  };
  const handleDelayedRetryPeriodChange = (period: 1 | 7 | 30) => {
    handleResetFilters();
    handleFilterChange("delayed_retry");
    handlePeriodChange(period);
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedLogId(null);
    replaceAuditQueryParam("page", String(page), "1");
  };

  return {
    auditQuery: buildAuditLogQuery({
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
    }),
    bulkOperations: {
      notificationStatus: selectedBulkNotificationStatus,
      page: bulkPage,
      period: selectedBulkPeriod,
      onNotificationStatusChange: handleBulkNotificationStatusChange,
      onPageChange: handleBulkPageChange,
      onPeriodChange: handleBulkPeriodChange,
    },
    filters: {
      selectedDeliveryProvider,
      selectedDeliveryStatus,
      selectedBulkNotificationStatus,
      selectedBulkPeriod,
      selectedFilter,
      selectedManagerSource,
      selectedManagerStatus,
      selectedPeriod,
      startDate,
      endDate,
      searchText,
      managerHealthWindowMinutes,
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
    requestedExpandedLogId: decodedQuery.requestedExpandedLogId,
    table: {
      currentPage,
      expandedLogId,
      pageSize,
      onExpandedLogChange: setExpandedLogId,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
    },
    trend: {
      selectedPeriod: selectedFilter === "delayed_retry" ? selectedPeriod : null,
      onSelectPeriod: handleDelayedRetryPeriodChange,
    },
  };
}

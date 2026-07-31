import {
  auditBulkNotificationStatusOptions,
  auditBulkPeriodOptions,
  auditFilters,
  auditPeriodOptions,
  deliveryProviderOptions,
  deliveryStatusOptions,
  managerHealthWindowOptions,
  managerSourceOptions,
  managerStatusOptions,
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

export interface AuditActiveConditionInput {
  selectedBulkNotificationStatus: AuditBulkNotificationStatus;
  selectedBulkPeriod: AuditBulkPeriod;
  selectedFilter: AuditFilterKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  selectedPeriod: AuditPeriodDays;
  startDate: string;
  endDate: string;
  managerHealthWindowMinutes: ManagerHealthWindowMinutes;
  searchText: string;
  onBulkNotificationStatusChange: (status: AuditBulkNotificationStatus) => void;
  onBulkPeriodChange: (period: AuditBulkPeriod) => void;
  onFilterChange: (filter: AuditFilterKey) => void;
  onManagerSourceChange: (source: ManagerSourceKey) => void;
  onManagerStatusChange: (status: ManagerStatusKey) => void;
  onManagerHealthWindowChange: (minutes: ManagerHealthWindowMinutes) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onPeriodChange: (period: AuditPeriodDays) => void;
  onSearchTextChange: (value: string) => void;
  onDeliveryStatusChange: (status: DeliveryStatusKey) => void;
  onDeliveryProviderChange: (provider: DeliveryProviderKey) => void;
}

export interface AuditActiveCondition {
  key: string;
  label: string;
  onRemove: () => void;
}

export function buildAuditActiveConditions({
  selectedBulkNotificationStatus,
  selectedBulkPeriod,
  selectedFilter,
  selectedDeliveryStatus,
  selectedDeliveryProvider,
  selectedManagerSource,
  selectedManagerStatus,
  selectedPeriod,
  startDate,
  endDate,
  managerHealthWindowMinutes,
  searchText,
  onBulkNotificationStatusChange,
  onBulkPeriodChange,
  onFilterChange,
  onManagerSourceChange,
  onManagerStatusChange,
  onManagerHealthWindowChange,
  onDateRangeChange,
  onPeriodChange,
  onSearchTextChange,
  onDeliveryStatusChange,
  onDeliveryProviderChange,
}: AuditActiveConditionInput): AuditActiveCondition[] {
  const conditions: AuditActiveCondition[] = [];
  if (searchText.trim()) {
    conditions.push({
      key: "search",
      label: `검색: ${searchText.trim()}`,
      onRemove: () => onSearchTextChange(""),
    });
  }
  if (selectedPeriod !== "all") {
    const label = auditPeriodOptions.find((option) => option.days === selectedPeriod)?.label;
    if (label) {
      conditions.push({
        key: "period",
        label: `기간: ${label}`,
        onRemove: () => onPeriodChange("all"),
      });
    }
  }
  if (startDate || endDate) {
    conditions.push({
      key: "date-range",
      label: `기간: ${startDate || "처음"} ~ ${endDate || "현재"}`,
      onRemove: () => onDateRangeChange("", ""),
    });
  }
  if (selectedBulkPeriod !== "all") {
    const label = auditBulkPeriodOptions.find(
      (option) => option.key === selectedBulkPeriod,
    )?.label;
    if (label) {
      conditions.push({
        key: "bulk-period",
        label: `일괄 기간: ${label}`,
        onRemove: () => onBulkPeriodChange("all"),
      });
    }
  }
  if (selectedBulkNotificationStatus !== "all") {
    const label = auditBulkNotificationStatusOptions.find(
      (option) => option.key === selectedBulkNotificationStatus,
    )?.label.replace(/^알림 /, "");
    if (label) {
      conditions.push({
        key: "bulk-notification-status",
        label: `일괄 알림: ${label}`,
        onRemove: () => onBulkNotificationStatusChange("all"),
      });
    }
  }
  if (selectedFilter !== "all") {
    const label = auditFilters.find((filter) => filter.key === selectedFilter)?.label;
    if (label) {
      conditions.push({ key: "filter", label, onRemove: () => onFilterChange("all") });
    }
  }
  if (selectedManagerSource !== "all") {
    const label = managerSourceOptions.find((option) => option.key === selectedManagerSource)?.label;
    if (label) {
      conditions.push({
        key: "manager-source",
        label: `소스: ${label}`,
        onRemove: () => onManagerSourceChange("all"),
      });
    }
  }
  if (selectedManagerStatus !== "all") {
    const label = managerStatusOptions.find((option) => option.key === selectedManagerStatus)?.label;
    if (label) {
      conditions.push({
        key: "manager-status",
        label: `상태: ${label}`,
        onRemove: () => onManagerStatusChange("all"),
      });
    }
  }
  if (managerHealthWindowMinutes !== 10080) {
    const label = managerHealthWindowOptions.find(
      (option) => option.minutes === managerHealthWindowMinutes,
    )?.label;
    if (label) {
      conditions.push({
        key: "manager-window",
        label: `집계: ${label}`,
        onRemove: () => onManagerHealthWindowChange(10080),
      });
    }
  }
  if (selectedDeliveryStatus !== "all") {
    const label = deliveryStatusOptions.find((option) => option.key === selectedDeliveryStatus)?.label;
    if (label) {
      conditions.push({
        key: "delivery-status",
        label,
        onRemove: () => onDeliveryStatusChange("all"),
      });
    }
  }
  if (selectedDeliveryProvider !== "all") {
    const label = deliveryProviderOptions.find(
      (option) => option.key === selectedDeliveryProvider,
    )?.label;
    if (label) {
      conditions.push({
        key: "delivery-provider",
        label: `채널: ${label}`,
        onRemove: () => onDeliveryProviderChange("all"),
      });
    }
  }
  return conditions;
}

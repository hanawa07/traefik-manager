import type { AuditLogQueryParams } from "@/features/audit/api/auditApi";

import type {
  AuditFilterKey,
  AuditPeriodDays,
  DeliveryProviderKey,
  DeliveryStatusKey,
  ManagerSourceKey,
  ManagerStatusKey,
} from "./auditPageHelpers";

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const;
export type AuditPageSize = (typeof AUDIT_PAGE_SIZES)[number];
export const AUDIT_PAGE_SIZE: AuditPageSize = 50;

interface BuildAuditLogQueryArgs {
  endDate: string;
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedFilter: AuditFilterKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  selectedPeriod: AuditPeriodDays;
  startDate: string;
  searchText: string;
  page: number;
  pageSize: AuditPageSize;
}

export function buildAuditLogQuery({
  endDate,
  selectedDeliveryProvider,
  selectedDeliveryStatus,
  selectedFilter,
  selectedManagerSource,
  selectedManagerStatus,
  selectedPeriod,
  startDate,
  searchText,
  page,
  pageSize,
}: BuildAuditLogQueryArgs): AuditLogQueryParams {
  return {
    ...buildFilterQuery(selectedFilter, selectedManagerSource, selectedManagerStatus),
    limit: pageSize,
    offset: (page - 1) * pageSize,
    period_days:
      startDate || endDate || selectedPeriod === "all" ? undefined : selectedPeriod,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    provider: selectedDeliveryProvider === "all" ? undefined : selectedDeliveryProvider,
    delivery_success:
      selectedDeliveryStatus === "all" ? undefined : selectedDeliveryStatus === "success",
    search: searchText || undefined,
  };
}

function buildFilterQuery(
  selectedFilter: AuditFilterKey,
  selectedManagerSource: ManagerSourceKey,
  selectedManagerStatus: ManagerStatusKey,
): AuditLogQueryParams {
  if (selectedFilter === "all") return {};
  if (selectedFilter === "security") return { security_only: true };
  if (selectedFilter === "alert_delivery") return { action: "alert" };
  if (selectedFilter === "manager_health") {
    return {
      resource_type: "manager_component",
      manager_source: selectedManagerSource === "all" ? undefined : selectedManagerSource,
      manager_status: selectedManagerStatus === "all" ? undefined : selectedManagerStatus,
    };
  }
  if (selectedFilter === "settings_update") {
    return { resource_type: "settings", action: "update" };
  }
  if (selectedFilter === "settings_test") {
    return { resource_type: "settings", action: "test" };
  }
  if (selectedFilter === "settings_rollback") {
    return { resource_type: "settings", action: "rollback" };
  }

  return { event: selectedFilter };
}

export function parseAuditPageSize(value: string | null): AuditPageSize {
  const pageSize = Number(value);
  return AUDIT_PAGE_SIZES.includes(pageSize as AuditPageSize)
    ? (pageSize as AuditPageSize)
    : AUDIT_PAGE_SIZE;
}

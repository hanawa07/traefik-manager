import type { AuditLogQueryParams } from "@/features/audit/api/auditApi";

import type {
  AuditFilterKey,
  DeliveryProviderKey,
  DeliveryStatusKey,
  ManagerSourceKey,
  ManagerStatusKey,
} from "./auditPageHelpers";

export const AUDIT_PAGE_SIZE = 50;

interface BuildAuditLogQueryArgs {
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedFilter: AuditFilterKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  searchText: string;
  page: number;
}

export function buildAuditLogQuery({
  selectedDeliveryProvider,
  selectedDeliveryStatus,
  selectedFilter,
  selectedManagerSource,
  selectedManagerStatus,
  searchText,
  page,
}: BuildAuditLogQueryArgs): AuditLogQueryParams {
  return {
    ...buildFilterQuery(selectedFilter, selectedManagerSource, selectedManagerStatus),
    limit: AUDIT_PAGE_SIZE,
    offset: (page - 1) * AUDIT_PAGE_SIZE,
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

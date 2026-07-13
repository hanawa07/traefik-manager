import type {
  AuditFilterKey,
  DeliveryProviderKey,
  DeliveryStatusKey,
  ManagerSourceKey,
  ManagerStatusKey,
} from "./auditPageHelpers";

interface AuditLogQuery {
  action?: string;
  delivery_success?: boolean;
  event?: string;
  limit: number;
  manager_status?: "unhealthy" | "recovered";
  manager_source?: "docker" | "watchdog";
  provider?: string;
  resource_type?: string;
  search?: string;
  security_only?: boolean;
}

interface BuildAuditLogQueryArgs {
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedFilter: AuditFilterKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  searchText: string;
}

export function buildAuditLogQuery({
  selectedDeliveryProvider,
  selectedDeliveryStatus,
  selectedFilter,
  selectedManagerSource,
  selectedManagerStatus,
  searchText,
}: BuildAuditLogQueryArgs): AuditLogQuery {
  return {
    ...buildFilterQuery(selectedFilter, selectedManagerSource, selectedManagerStatus),
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
): AuditLogQuery {
  if (selectedFilter === "all") return { limit: 50 };
  if (selectedFilter === "security") return { limit: 50, security_only: true };
  if (selectedFilter === "alert_delivery") return { limit: 50, action: "alert" };
  if (selectedFilter === "manager_health") {
    return {
      limit: 50,
      resource_type: "manager_component",
      manager_source: selectedManagerSource === "all" ? undefined : selectedManagerSource,
      manager_status: selectedManagerStatus === "all" ? undefined : selectedManagerStatus,
    };
  }
  if (selectedFilter === "settings_update") {
    return { limit: 50, resource_type: "settings", action: "update" };
  }
  if (selectedFilter === "settings_test") {
    return { limit: 50, resource_type: "settings", action: "test" };
  }
  if (selectedFilter === "settings_rollback") {
    return { limit: 50, resource_type: "settings", action: "rollback" };
  }

  return { limit: 50, event: selectedFilter };
}

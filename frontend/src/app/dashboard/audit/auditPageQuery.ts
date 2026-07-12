import type {
  AuditFilterKey,
  DeliveryProviderKey,
  DeliveryStatusKey,
} from "./auditPageHelpers";

interface AuditLogQuery {
  action?: string;
  delivery_success?: boolean;
  event?: string;
  limit: number;
  provider?: string;
  resource_type?: string;
  security_only?: boolean;
}

interface BuildAuditLogQueryArgs {
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedFilter: AuditFilterKey;
}

export function buildAuditLogQuery({
  selectedDeliveryProvider,
  selectedDeliveryStatus,
  selectedFilter,
}: BuildAuditLogQueryArgs): AuditLogQuery {
  return {
    ...buildFilterQuery(selectedFilter),
    provider: selectedDeliveryProvider === "all" ? undefined : selectedDeliveryProvider,
    delivery_success:
      selectedDeliveryStatus === "all" ? undefined : selectedDeliveryStatus === "success",
  };
}

function buildFilterQuery(selectedFilter: AuditFilterKey): AuditLogQuery {
  if (selectedFilter === "all") return { limit: 50 };
  if (selectedFilter === "security") return { limit: 50, security_only: true };
  if (selectedFilter === "alert_delivery") return { limit: 50, action: "alert" };
  if (selectedFilter === "manager_health") {
    return { limit: 50, resource_type: "manager_component" };
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

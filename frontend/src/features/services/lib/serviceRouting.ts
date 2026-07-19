import type { RoutingMode, Service } from "../api/serviceApi";

export type ServiceRoutingCounts = Record<RoutingMode, number>;

export function countServiceRoutingModes(services: Service[]): ServiceRoutingCounts {
  const counts: ServiceRoutingCounts = { active: 0, disabled: 0, maintenance: 0 };
  for (const service of services) {
    counts[service.routing_mode] += 1;
  }
  return counts;
}

export function getRoutingUpdateTargets(
  services: Service[],
  selectedServiceIds: string[],
  routingMode: RoutingMode,
) {
  const selected = new Set(selectedServiceIds);
  return services.filter(
    (service) => selected.has(service.id) && service.routing_mode !== routingMode,
  );
}

export async function applyRoutingModeUpdates(
  services: Service[],
  routingMode: RoutingMode,
  update: (serviceId: string, routingMode: RoutingMode) => Promise<unknown>,
) {
  const failedServiceIds: string[] = [];
  for (const service of services) {
    try {
      await update(service.id, routingMode);
    } catch {
      failedServiceIds.push(service.id);
    }
  }
  return {
    successCount: services.length - failedServiceIds.length,
    failedServiceIds,
  };
}

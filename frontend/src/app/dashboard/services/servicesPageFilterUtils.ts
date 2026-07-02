import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { compareServices } from "./servicesPageSortUtils";
import type { HealthFilter, SortDir, SortKey } from "./servicesPageTypes";

interface FilterAndSortServicesArgs {
  healthFilter: HealthFilter;
  healthMap?: Record<string, UpstreamHealth>;
  routerStatus?: TraefikRouterStatus;
  search: string;
  services: Service[];
  sortDir: SortDir;
  sortKey: SortKey;
}

export function filterAndSortServices({
  services,
  search,
  healthFilter,
  sortKey,
  sortDir,
  routerStatus,
  healthMap,
}: FilterAndSortServicesArgs) {
  const filtered = filterServicesBySearch(services, search).filter((service) =>
    matchesHealthFilter(service, healthFilter, healthMap),
  );

  filtered.sort((a, b) => {
    const cmp = compareServices(a, b, sortKey, routerStatus, healthMap);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return filtered;
}

function filterServicesBySearch(services: Service[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return [...services];

  return services.filter(
    (service) =>
      service.name.toLowerCase().includes(query) ||
      service.domain.toLowerCase().includes(query),
  );
}

export function matchesHealthFilter(
  service: Service,
  healthFilter: HealthFilter,
  healthMap?: Record<string, UpstreamHealth>,
) {
  const health = healthMap?.[service.id];
  if (healthFilter === "all") return true;
  if (!health) return false;

  if (healthFilter === "up" || healthFilter === "down" || healthFilter === "unknown") {
    return health.status === healthFilter;
  }
  if (healthFilter === "dns") return health.error_kind === "dns";
  if (healthFilter === "connection_refused") return health.error_kind === "connection_refused";
  if (healthFilter === "timeout") {
    return health.error_kind === "connection_timeout" || health.error_kind === "request_timeout";
  }
  if (healthFilter === "unexpected_status") return health.error_kind === "unexpected_status";
  if (healthFilter === "other_error") return matchesOtherHealthError(health);

  return true;
}

function matchesOtherHealthError(health: UpstreamHealth) {
  const knownErrorKinds = [
    "dns",
    "connection_refused",
    "connection_timeout",
    "request_timeout",
    "unexpected_status",
  ];

  return health.status === "down" && !knownErrorKinds.includes(health.error_kind || "");
}

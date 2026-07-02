import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { getHealthWeight } from "./servicesPageHealthUtils";
import type { SortKey } from "./servicesPageTypes";

export function compareServices(
  a: Service,
  b: Service,
  sortKey: SortKey,
  routerStatus?: TraefikRouterStatus,
  healthMap?: Record<string, UpstreamHealth>,
) {
  if (sortKey === "name") return a.name.localeCompare(b.name);
  if (sortKey === "domain") return a.domain.localeCompare(b.domain);
  if (sortKey === "auth") return getAuthWeight(b) - getAuthWeight(a);
  if (sortKey === "router") return compareRouterStatus(a, b, routerStatus);
  if (sortKey === "health") return getHealthWeight(b, healthMap) - getHealthWeight(a, healthMap);
  if (sortKey === "created_at") return a.created_at > b.created_at ? 1 : -1;
  return 0;
}

function compareRouterStatus(
  a: Service,
  b: Service,
  routerStatus?: TraefikRouterStatus,
) {
  const aActive = routerStatus?.domains?.[a.domain]?.active;
  const bActive = routerStatus?.domains?.[b.domain]?.active;
  return Number(bActive ?? false) - Number(aActive ?? false);
}

function getAuthWeight(service: Service) {
  if (service.auth_mode === "authentik") return 3;
  if (service.auth_mode === "token") return 2;
  if (service.basic_auth_enabled) return 1;
  return 0;
}

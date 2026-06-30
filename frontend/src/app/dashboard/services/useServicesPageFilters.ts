"use client";

import { useMemo, useState } from "react";

import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import type { HealthFilter, SortDir, SortKey } from "./servicesPageTypes";

interface UseServicesPageFiltersArgs {
  healthMap?: Record<string, UpstreamHealth>;
  routerStatus?: TraefikRouterStatus;
  services: Service[];
}

export function useServicesPageFilters({
  healthMap,
  routerStatus,
  services,
}: UseServicesPageFiltersArgs) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");

  const filteredServices = useMemo(
    () =>
      filterAndSortServices({
        services,
        search,
        healthFilter,
        sortKey,
        sortDir,
        routerStatus,
        healthMap,
      }),
    [services, search, healthFilter, sortKey, sortDir, routerStatus, healthMap],
  );

  return {
    filteredServices,
    healthFilter,
    search,
    setHealthFilter,
    setSearch,
    setSortDir,
    setSortKey,
    sortDir,
    sortKey,
  };
}

function filterAndSortServices({
  services,
  search,
  healthFilter,
  sortKey,
  sortDir,
  routerStatus,
  healthMap,
}: {
  healthFilter: HealthFilter;
  healthMap?: Record<string, UpstreamHealth>;
  routerStatus?: TraefikRouterStatus;
  search: string;
  services: Service[];
  sortDir: SortDir;
  sortKey: SortKey;
}) {
  const q = search.trim().toLowerCase();
  const result = q
    ? services.filter(
        (service) =>
          service.name.toLowerCase().includes(q) ||
          service.domain.toLowerCase().includes(q),
      )
    : [...services];

  const filtered = result.filter((service) =>
    matchesHealthFilter(service, healthFilter, healthMap),
  );
  filtered.sort((a, b) => {
    const cmp = compareServices(a, b, sortKey, routerStatus, healthMap);
    return sortDir === "asc" ? cmp : -cmp;
  });
  return filtered;
}

function matchesHealthFilter(
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
  if (healthFilter === "other_error") {
    const knownErrorKinds = [
      "dns",
      "connection_refused",
      "connection_timeout",
      "request_timeout",
      "unexpected_status",
    ];

    return (
      health.status === "down" &&
      !knownErrorKinds.includes(health.error_kind || "")
    );
  }
  return true;
}

function compareServices(
  a: Service,
  b: Service,
  sortKey: SortKey,
  routerStatus?: TraefikRouterStatus,
  healthMap?: Record<string, UpstreamHealth>,
) {
  if (sortKey === "name") return a.name.localeCompare(b.name);
  if (sortKey === "domain") return a.domain.localeCompare(b.domain);
  if (sortKey === "auth") return getAuthWeight(b) - getAuthWeight(a);
  if (sortKey === "router") {
    const ra = routerStatus?.domains?.[a.domain]?.active;
    const rb = routerStatus?.domains?.[b.domain]?.active;
    return Number(rb ?? false) - Number(ra ?? false);
  }
  if (sortKey === "health") return getHealthWeight(b, healthMap) - getHealthWeight(a, healthMap);
  if (sortKey === "created_at") return a.created_at > b.created_at ? 1 : -1;
  return 0;
}

function getAuthWeight(service: Service) {
  if (service.auth_mode === "authentik") return 3;
  if (service.auth_mode === "token") return 2;
  if (service.basic_auth_enabled) return 1;
  return 0;
}

function getHealthWeight(service: Service, healthMap?: Record<string, UpstreamHealth>) {
  const status = healthMap?.[service.id]?.status;
  if (status === "down") return 2;
  if (status === "unknown" || status === undefined) return 1;
  return 0;
}

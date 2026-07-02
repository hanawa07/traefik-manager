"use client";

import { useMemo, useState } from "react";

import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { filterAndSortServices } from "./servicesPageFilterUtils";
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

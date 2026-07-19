"use client";

import { useEffect, useMemo, useState } from "react";

import type { Service, UpstreamHealth } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { filterAndSortServices } from "./servicesPageFilterUtils";
import type { HealthFilter, SortDir, SortKey } from "./servicesPageTypes";

const DEFAULT_SEARCH = "";
const DEFAULT_SORT_KEY: SortKey = "name";
const DEFAULT_SORT_DIR: SortDir = "asc";
const DEFAULT_HEALTH_FILTER: HealthFilter = "all";
const SORT_KEYS: SortKey[] = ["name", "domain", "auth", "router", "health", "created_at"];
const SORT_DIRS: SortDir[] = ["asc", "desc"];
const HEALTH_FILTERS: HealthFilter[] = [
  "all",
  "up",
  "down",
  "unknown",
  "active",
  "disabled",
  "maintenance",
  "dns",
  "connection_refused",
  "timeout",
  "unexpected_status",
  "other_error",
];

interface UseServicesPageFiltersArgs {
  healthMap?: Record<string, UpstreamHealth>;
  routerStatus?: TraefikRouterStatus;
  services: Service[];
}

interface ServicesPageUrlFilters {
  healthFilter: HealthFilter;
  search: string;
  sortDir: SortDir;
  sortKey: SortKey;
}

function isSortKey(value: string | null): value is SortKey {
  return SORT_KEYS.includes(value as SortKey);
}

function isSortDir(value: string | null): value is SortDir {
  return SORT_DIRS.includes(value as SortDir);
}

function isHealthFilter(value: string | null): value is HealthFilter {
  return HEALTH_FILTERS.includes(value as HealthFilter);
}

function readFiltersFromUrl(): ServicesPageUrlFilters {
  if (typeof window === "undefined") {
    return {
      healthFilter: DEFAULT_HEALTH_FILTER,
      search: DEFAULT_SEARCH,
      sortDir: DEFAULT_SORT_DIR,
      sortKey: DEFAULT_SORT_KEY,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const search = params.get("search") ?? DEFAULT_SEARCH;
  const sortKey = params.get("sort");
  const sortDir = params.get("dir");
  const healthFilter = params.get("health");

  return {
    healthFilter: isHealthFilter(healthFilter) ? healthFilter : DEFAULT_HEALTH_FILTER,
    search,
    sortDir: isSortDir(sortDir) ? sortDir : DEFAULT_SORT_DIR,
    sortKey: isSortKey(sortKey) ? sortKey : DEFAULT_SORT_KEY,
  };
}

function replaceFiltersInUrl({ healthFilter, search, sortDir, sortKey }: ServicesPageUrlFilters) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    url.searchParams.set("search", trimmedSearch);
  } else {
    url.searchParams.delete("search");
  }

  if (healthFilter === DEFAULT_HEALTH_FILTER) {
    url.searchParams.delete("health");
  } else {
    url.searchParams.set("health", healthFilter);
  }

  if (sortKey === DEFAULT_SORT_KEY) {
    url.searchParams.delete("sort");
  } else {
    url.searchParams.set("sort", sortKey);
  }

  if (sortDir === DEFAULT_SORT_DIR) {
    url.searchParams.delete("dir");
  } else {
    url.searchParams.set("dir", sortDir);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function useServicesPageFilters({
  healthMap,
  routerStatus,
  services,
}: UseServicesPageFiltersArgs) {
  const [search, setSearch] = useState(DEFAULT_SEARCH);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>(DEFAULT_HEALTH_FILTER);
  const [isUrlReady, setIsUrlReady] = useState(false);

  useEffect(() => {
    function applyFiltersFromUrl() {
      const filters = readFiltersFromUrl();
      setSearch(filters.search);
      setSortKey(filters.sortKey);
      setSortDir(filters.sortDir);
      setHealthFilter(filters.healthFilter);
    }

    applyFiltersFromUrl();
    setIsUrlReady(true);
    window.addEventListener("popstate", applyFiltersFromUrl);

    return () => window.removeEventListener("popstate", applyFiltersFromUrl);
  }, []);

  useEffect(() => {
    if (!isUrlReady) {
      return;
    }

    replaceFiltersInUrl({ healthFilter, search, sortDir, sortKey });
  }, [healthFilter, isUrlReady, search, sortDir, sortKey]);

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

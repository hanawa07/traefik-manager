"use client";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useCertificates } from "@/features/certificates/hooks/useCertificates";
import type { Service } from "@/features/services/api/serviceApi";
import { useAllServicesHealth, useDeleteService, useServices } from "@/features/services/hooks/useServices";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { useTraefikRouterStatus } from "@/features/traefik/hooks/useTraefik";

export type SortKey = "name" | "domain" | "auth" | "router" | "health" | "created_at";
export type SortDir = "asc" | "desc";
export type HealthFilter =
  | "all"
  | "up"
  | "down"
  | "unknown"
  | "dns"
  | "connection_refused"
  | "timeout"
  | "unexpected_status"
  | "other_error";

export type HealthHistoryEntry = {
  last_up_at?: string;
  last_down_at?: string;
  last_unknown_at?: string;
};

export function useServicesPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: services = [], isLoading } = useServices();
  const { data: routerStatus } = useTraefikRouterStatus();
  const { data: healthMap } = useAllServicesHealth();
  const { data: certificates = [] } = useCertificates();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const deleteService = useDeleteService();
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthHistoryEntry>>({});

  useEffect(() => {
    if (!healthMap) return;

    setHealthHistory((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const [serviceId, health] of Object.entries(healthMap)) {
        const entry = next[serviceId] ?? {};
        if (health.status === "up" && entry.last_up_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_up_at: health.checked_at };
          changed = true;
        } else if (health.status === "down" && entry.last_down_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_down_at: health.checked_at };
          changed = true;
        } else if (health.status === "unknown" && entry.last_unknown_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_unknown_at: health.checked_at };
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [healthMap]);

  const filteredServices = useMemo(
    () => filterAndSortServices({
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

  const certificateMap = useMemo(
    () => Object.fromEntries(certificates.map((certificate) => [certificate.domain, certificate])),
    [certificates],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteService.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return {
    canManage,
    services,
    filteredServices,
    isLoading,
    routerStatus,
    healthMap,
    healthHistory,
    certificateMap,
    displayTimeZone: timeDisplaySettings?.display_timezone,
    deleteTarget,
    deletePending: deleteService.isPending,
    search,
    sortKey,
    sortDir,
    healthFilter,
    setDeleteTarget,
    setSearch,
    setSortKey,
    setSortDir,
    setHealthFilter,
    handleDelete,
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
  services: Service[];
  search: string;
  healthFilter: HealthFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  routerStatus: ReturnType<typeof useTraefikRouterStatus>["data"];
  healthMap: ReturnType<typeof useAllServicesHealth>["data"];
}) {
  const q = search.trim().toLowerCase();
  const result = q
    ? services.filter((service) => service.name.toLowerCase().includes(q) || service.domain.toLowerCase().includes(q))
    : [...services];

  const filtered = result.filter((service) => matchesHealthFilter(service, healthFilter, healthMap));
  filtered.sort((a, b) => {
    const cmp = compareServices(a, b, sortKey, routerStatus, healthMap);
    return sortDir === "asc" ? cmp : -cmp;
  });
  return filtered;
}

function matchesHealthFilter(
  service: Service,
  healthFilter: HealthFilter,
  healthMap: ReturnType<typeof useAllServicesHealth>["data"],
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
    return (
      health.status === "down" &&
      !["dns", "connection_refused", "connection_timeout", "request_timeout", "unexpected_status"].includes(
        health.error_kind || "",
      )
    );
  }
  return true;
}

function compareServices(
  a: Service,
  b: Service,
  sortKey: SortKey,
  routerStatus: ReturnType<typeof useTraefikRouterStatus>["data"],
  healthMap: ReturnType<typeof useAllServicesHealth>["data"],
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

function getHealthWeight(service: Service, healthMap: ReturnType<typeof useAllServicesHealth>["data"]) {
  const status = healthMap?.[service.id]?.status;
  if (status === "down") return 2;
  if (status === "unknown" || status === undefined) return 1;
  return 0;
}

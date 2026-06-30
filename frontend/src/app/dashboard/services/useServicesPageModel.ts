"use client";

import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";

import { useServicesPageData } from "./useServicesPageData";
import { useServicesPageDeleteAction } from "./useServicesPageDeleteAction";
import { useServicesPageFilters } from "./useServicesPageFilters";
import { useServicesPageHealthHistory } from "./useServicesPageHealthHistory";

export type { HealthFilter, HealthHistoryEntry, SortDir, SortKey } from "./servicesPageTypes";

export function useServicesPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const data = useServicesPageData();
  const healthHistory = useServicesPageHealthHistory(data.healthMap);
  const deleteAction = useServicesPageDeleteAction();
  const filters = useServicesPageFilters({
    healthMap: data.healthMap,
    routerStatus: data.routerStatus,
    services: data.services,
  });

  const certificateMap = useMemo(
    () =>
      Object.fromEntries(
        data.certificates.map((certificate) => [certificate.domain, certificate]),
      ),
    [data.certificates],
  );

  return {
    canManage,
    services: data.services,
    filteredServices: filters.filteredServices,
    isLoading: data.isLoading,
    routerStatus: data.routerStatus,
    healthMap: data.healthMap,
    healthHistory,
    certificateMap,
    displayTimeZone: data.displayTimeZone,
    deleteTarget: deleteAction.deleteTarget,
    deletePending: deleteAction.deletePending,
    search: filters.search,
    sortKey: filters.sortKey,
    sortDir: filters.sortDir,
    healthFilter: filters.healthFilter,
    setDeleteTarget: deleteAction.setDeleteTarget,
    setSearch: filters.setSearch,
    setSortKey: filters.setSortKey,
    setSortDir: filters.setSortDir,
    setHealthFilter: filters.setHealthFilter,
    handleDelete: deleteAction.handleDelete,
  };
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import type { ContainerImportMode, TraefikImportCandidate } from "./containerImportTypes";
import {
  applyBasicContainerImport,
  applyTraefikContainerImport,
} from "./containerImportApply";
import {
  buildTraefikImportCandidates,
  filterDockerContainers,
  filterTraefikImportCandidates,
} from "./containerImportFiltering";
import type { ServiceFormData } from "./serviceFormSchema";

interface UseServiceContainerImportModelParams {
  setValue: UseFormSetValue<ServiceFormData>;
}

export function useServiceContainerImportModel({ setValue }: UseServiceContainerImportModelParams) {
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [containerImportMode, setContainerImportMode] = useState<ContainerImportMode>("basic");
  const [containerSearchQuery, setContainerSearchQuery] = useState("");
  const deferredContainerSearchQuery = useDeferredValue(containerSearchQuery);
  const {
    data: dockerContainers,
    isLoading: isDockerLoading,
    isFetching: isDockerFetching,
    isError: isDockerError,
    error: dockerContainersError,
  } = useDockerContainers(isContainerModalOpen);

  const availableContainers = useMemo(() => dockerContainers?.containers || [], [dockerContainers]);
  const traefikImportCandidates = useMemo(
    () => buildTraefikImportCandidates(availableContainers),
    [availableContainers],
  );

  const normalizedContainerSearchQuery = deferredContainerSearchQuery.trim().toLowerCase();
  const filteredContainers = useMemo(
    () => filterDockerContainers(availableContainers, normalizedContainerSearchQuery),
    [availableContainers, normalizedContainerSearchQuery],
  );

  const filteredTraefikImportCandidates = useMemo(
    () => filterTraefikImportCandidates(traefikImportCandidates, normalizedContainerSearchQuery),
    [normalizedContainerSearchQuery, traefikImportCandidates],
  );

  const openContainerImportModal = () => {
    setContainerImportMode("basic");
    setContainerSearchQuery("");
    setIsContainerModalOpen(true);
  };

  const handleBasicContainerImport = (container: Parameters<typeof applyBasicContainerImport>[1]) => {
    applyBasicContainerImport(setValue, container);
    setIsContainerModalOpen(false);
  };

  const handleTraefikContainerImport = (candidate: TraefikImportCandidate) => {
    applyTraefikContainerImport(setValue, candidate);
    setIsContainerModalOpen(false);
  };

  return {
    onOpenContainerImportModal: openContainerImportModal,
    containerImportModal: {
      isOpen: isContainerModalOpen,
      onClose: () => setIsContainerModalOpen(false),
      mode: containerImportMode,
      onModeChange: setContainerImportMode,
      searchQuery: containerSearchQuery,
      onSearchQueryChange: setContainerSearchQuery,
      dockerContainers,
      dockerContainersError,
      isDockerLoading,
      isDockerFetching,
      isDockerError,
      availableContainers,
      filteredContainers,
      normalizedSearchQuery: normalizedContainerSearchQuery,
      traefikImportCandidates,
      filteredTraefikImportCandidates,
      onBasicImport: handleBasicContainerImport,
      onTraefikImport: handleTraefikContainerImport,
    },
  };
}

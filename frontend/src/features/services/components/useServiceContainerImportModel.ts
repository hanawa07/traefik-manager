"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { DockerContainer } from "@/features/docker/api/dockerApi";
import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import type { ContainerImportMode, TraefikImportCandidate } from "./containerImportTypes";
import type { ServiceFormData } from "./serviceFormSchema";
import { formatDockerPortLabel, getSuggestedUpstreamPort } from "./serviceFormUtils";

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
  const traefikImportCandidates = useMemo(() => {
    return availableContainers.flatMap((container) =>
      container.traefik_candidates.map((candidate) => ({
        containerName: container.name,
        image: container.image,
        networks: container.networks,
        ...candidate,
      })),
    );
  }, [availableContainers]);

  const normalizedContainerSearchQuery = deferredContainerSearchQuery.trim().toLowerCase();
  const filteredContainers = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return availableContainers;
    }

    return availableContainers.filter((container) => {
      const haystack = [
        container.name,
        container.image || "",
        container.state || "",
        container.status || "",
        ...container.networks,
        ...container.ports.map((port) => formatDockerPortLabel(port)),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [availableContainers, normalizedContainerSearchQuery]);

  const filteredTraefikImportCandidates = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return traefikImportCandidates;
    }

    return traefikImportCandidates.filter((candidate) => {
      const haystack = [
        candidate.domain,
        candidate.containerName,
        candidate.image || "",
        candidate.router_name,
        String(candidate.upstream_port),
        ...candidate.networks,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [normalizedContainerSearchQuery, traefikImportCandidates]);

  const openContainerImportModal = () => {
    setContainerImportMode("basic");
    setContainerSearchQuery("");
    setIsContainerModalOpen(true);
  };

  const applyBasicContainerImport = (container: DockerContainer) => {
    setValue("name", container.name);
    setValue("upstream_host", container.name);
    setValue("upstream_port", getSuggestedUpstreamPort(container));
    setIsContainerModalOpen(false);
  };

  const applyTraefikContainerImport = (candidate: TraefikImportCandidate) => {
    setValue("name", candidate.containerName);
    setValue("domain", candidate.domain);
    setValue("upstream_host", candidate.upstream_host);
    setValue("upstream_port", candidate.upstream_port);
    setValue("tls_enabled", candidate.tls_enabled);
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
      onBasicImport: applyBasicContainerImport,
      onTraefikImport: applyTraefikContainerImport,
    },
  };
}

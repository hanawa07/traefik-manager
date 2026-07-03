import type { DockerContainer, DockerContainerListResponse } from "@/features/docker/api/dockerApi";

import ContainerImportBasicList from "./ContainerImportBasicList";
import ContainerImportTraefikList from "./ContainerImportTraefikList";
import { getDockerErrorMessage } from "./containerImportErrors";
import type { ContainerImportMode, TraefikImportCandidate } from "./containerImportTypes";

interface ContainerImportResultsPanelProps {
  mode: ContainerImportMode;
  dockerContainers: DockerContainerListResponse | undefined;
  dockerContainersError: unknown;
  isDockerLoading: boolean;
  isDockerFetching: boolean;
  isDockerError: boolean;
  availableContainers: DockerContainer[];
  filteredContainers: DockerContainer[];
  normalizedSearchQuery: string;
  traefikImportCandidates: TraefikImportCandidate[];
  filteredTraefikImportCandidates: TraefikImportCandidate[];
  onBasicImport: (container: DockerContainer) => void;
  onTraefikImport: (candidate: TraefikImportCandidate) => void;
}

export function ContainerImportResultsPanel({
  mode,
  dockerContainers,
  dockerContainersError,
  isDockerLoading,
  isDockerFetching,
  isDockerError,
  availableContainers,
  filteredContainers,
  normalizedSearchQuery,
  traefikImportCandidates,
  filteredTraefikImportCandidates,
  onBasicImport,
  onTraefikImport,
}: ContainerImportResultsPanelProps) {
  if (isDockerLoading || (isDockerFetching && !dockerContainers)) {
    return <ContainerImportLoadingState />;
  }

  if (isDockerError) {
    return <ContainerImportErrorNotice error={dockerContainersError} />;
  }

  if (!dockerContainers || !dockerContainers.enabled) {
    return <ContainerImportUnavailableNotice message={dockerContainers?.message} />;
  }

  if (mode === "basic") {
    return (
      <ContainerImportBasicList
        availableContainers={availableContainers}
        filteredContainers={filteredContainers}
        normalizedSearchQuery={normalizedSearchQuery}
        onImport={onBasicImport}
      />
    );
  }

  return (
    <ContainerImportTraefikList
      traefikImportCandidates={traefikImportCandidates}
      filteredTraefikImportCandidates={filteredTraefikImportCandidates}
      normalizedSearchQuery={normalizedSearchQuery}
      onImport={onTraefikImport}
    />
  );
}

function ContainerImportLoadingState() {
  return (
    <div className="space-y-2">
      <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
    </div>
  );
}

function ContainerImportErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {getDockerErrorMessage(error)}
    </div>
  );
}

function ContainerImportUnavailableNotice({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      {message || "Docker 자동 감지를 사용할 수 없습니다."}
    </div>
  );
}

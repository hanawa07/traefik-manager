import type { DockerContainer, DockerContainerListResponse } from "@/features/docker/api/dockerApi";
import Modal from "@/shared/components/Modal";
import ContainerImportModeTabs from "./ContainerImportModeTabs";
import { ContainerImportResultsPanel } from "./ContainerImportResultsPanel";
import ContainerImportSearchInput from "./ContainerImportSearchInput";
import type { ContainerImportMode, TraefikImportCandidate } from "./containerImportTypes";

interface ServiceContainerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ContainerImportMode;
  onModeChange: (mode: ContainerImportMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
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

export default function ServiceContainerImportModal({
  isOpen,
  onClose,
  mode,
  onModeChange,
  searchQuery,
  onSearchQueryChange,
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
}: ServiceContainerImportModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="컨테이너 정보 가져오기"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          새 서비스는 일반 컨테이너에서 업스트림만 가져오고, 기존 Traefik 운영분은 라벨까지 함께 가져올 수 있습니다.
        </p>

        <ContainerImportModeTabs
          basicCount={availableContainers.length}
          mode={mode}
          onModeChange={onModeChange}
          traefikCount={traefikImportCandidates.length}
        />

        <ContainerImportSearchInput
          mode={mode}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />

        <ContainerImportResultsPanel
          mode={mode}
          dockerContainers={dockerContainers}
          dockerContainersError={dockerContainersError}
          isDockerLoading={isDockerLoading}
          isDockerFetching={isDockerFetching}
          isDockerError={isDockerError}
          availableContainers={availableContainers}
          filteredContainers={filteredContainers}
          normalizedSearchQuery={normalizedSearchQuery}
          traefikImportCandidates={traefikImportCandidates}
          filteredTraefikImportCandidates={filteredTraefikImportCandidates}
          onBasicImport={onBasicImport}
          onTraefikImport={onTraefikImport}
        />
      </div>
    </Modal>
  );
}

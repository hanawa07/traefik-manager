import type { DockerContainer, DockerContainerListResponse } from "@/features/docker/api/dockerApi";
import Modal from "@/shared/components/Modal";
import ContainerImportBasicList from "./ContainerImportBasicList";
import ContainerImportModeTabs from "./ContainerImportModeTabs";
import ContainerImportSearchInput from "./ContainerImportSearchInput";
import ContainerImportTraefikList from "./ContainerImportTraefikList";
import { getDockerErrorMessage } from "./containerImportErrors";
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

        <ContainerImportModeTabs mode={mode} onModeChange={onModeChange} />

        <ContainerImportSearchInput
          mode={mode}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />

        {isDockerLoading || (isDockerFetching && !dockerContainers) ? (
          <div className="space-y-2">
            <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
            <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
          </div>
        ) : isDockerError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getDockerErrorMessage(dockerContainersError)}
          </div>
        ) : !dockerContainers || !dockerContainers.enabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {dockerContainers?.message || "Docker 자동 감지를 사용할 수 없습니다."}
          </div>
        ) : mode === "basic" ? (
          <ContainerImportBasicList
            availableContainers={availableContainers}
            filteredContainers={filteredContainers}
            normalizedSearchQuery={normalizedSearchQuery}
            onImport={onBasicImport}
          />
        ) : (
          <ContainerImportTraefikList
            traefikImportCandidates={traefikImportCandidates}
            filteredTraefikImportCandidates={filteredTraefikImportCandidates}
            normalizedSearchQuery={normalizedSearchQuery}
            onImport={onTraefikImport}
          />
        )}
      </div>
    </Modal>
  );
}

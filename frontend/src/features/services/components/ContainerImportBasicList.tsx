import type { DockerContainer } from "@/features/docker/api/dockerApi";

import { ContainerImportBasicEmptyState } from "./ContainerImportBasicEmptyState";
import { ContainerImportBasicItem } from "./ContainerImportBasicItem";

interface ContainerImportBasicListProps {
  availableContainers: DockerContainer[];
  filteredContainers: DockerContainer[];
  normalizedSearchQuery: string;
  onImport: (container: DockerContainer) => void;
}

export default function ContainerImportBasicList({
  availableContainers,
  filteredContainers,
  normalizedSearchQuery,
  onImport,
}: ContainerImportBasicListProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
        컨테이너 이름과 내부 포트를 가져와 업스트림을 빠르게 채웁니다. 도메인은 직접 입력하고, Manager/Traefik와 같은
        Docker 네트워크에 붙어 있는지 확인하세요.
      </div>

      <p className="text-xs text-gray-500">
        {filteredContainers.length} / {availableContainers.length}개 표시
      </p>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {filteredContainers.length === 0 ? (
          <ContainerImportBasicEmptyState normalizedSearchQuery={normalizedSearchQuery} />
        ) : (
          filteredContainers.map((container) => (
            <ContainerImportBasicItem
              key={container.id || container.name}
              container={container}
              onImport={onImport}
            />
          ))
        )}
      </div>
    </div>
  );
}

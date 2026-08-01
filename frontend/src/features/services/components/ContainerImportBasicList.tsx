import type { DockerContainer } from "@/features/docker/api/dockerApi";

import { ContainerImportBasicEmptyState } from "./ContainerImportBasicEmptyState";
import { ContainerImportBasicItem } from "./ContainerImportBasicItem";
import {
  findRecommendedComposeGateway,
  isRecommendedComposeGateway,
  isLikelyNonHttpContainer,
} from "./containerImportFiltering";

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
  const httpContainers = filteredContainers.filter(
    (container) => !isLikelyNonHttpContainer(container),
  );
  const nonHttpContainers = filteredContainers.filter(isLikelyNonHttpContainer);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        컨테이너 이름과 내부 포트를 가져와 업스트림을 빠르게 채웁니다. 도메인은 직접 입력하고, Manager/Traefik와 같은
        Docker 네트워크에 붙어 있는지 확인하세요.
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400">
        {filteredContainers.length} / {availableContainers.length}개 표시
      </p>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {filteredContainers.length === 0 ? (
          <ContainerImportBasicEmptyState normalizedSearchQuery={normalizedSearchQuery} />
        ) : (
          <>
            {httpContainers.map((container) => (
              <ContainerImportBasicItem
                key={container.id || container.name}
                container={container}
                isRecommendedGateway={isRecommendedComposeGateway(container, availableContainers)}
                recommendedGatewayName={
                  findRecommendedComposeGateway(container, availableContainers)?.name
                }
                onImport={onImport}
              />
            ))}

            {nonHttpContainers.length > 0 ? (
              <details
                className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
                open={Boolean(normalizedSearchQuery)}
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  비HTTP/데이터 컨테이너 {nonHttpContainers.length}개
                </summary>
                <div className="space-y-2 border-t border-amber-200 p-3 dark:border-amber-500/30">
                  <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                    DB나 캐시로 보이는 항목입니다. 일반 웹 서비스가 아니면 Traefik 업스트림으로 등록하지 마세요.
                  </p>
                  {nonHttpContainers.map((container) => (
                    <ContainerImportBasicItem
                      key={container.id || container.name}
                      container={container}
                      isRecommendedGateway={false}
                      isLikelyNonHttp
                      onImport={onImport}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

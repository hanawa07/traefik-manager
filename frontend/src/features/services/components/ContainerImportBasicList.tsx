import type { DockerContainer } from "@/features/docker/api/dockerApi";

import { formatDockerPortLabel, getSuggestedUpstreamPort } from "./serviceFormUtils";

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
          <p className="py-10 text-center text-sm text-gray-500">
            {normalizedSearchQuery ? "검색 조건과 일치하는 컨테이너가 없습니다." : "실행 중인 컨테이너가 없습니다."}
          </p>
        ) : (
          filteredContainers.map((container) => (
            <button
              key={container.id || container.name}
              type="button"
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50"
              onClick={() => onImport(container)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{container.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {container.image || "이미지 정보를 확인할 수 없습니다"}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  {container.state || "unknown"}
                </span>
              </div>

              {container.status && <p className="mt-2 text-xs text-gray-500">{container.status}</p>}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {container.ports.length > 0 ? (
                  container.ports.map((port) => (
                    <span
                      key={`${container.name}-${port.private_port}-${port.public_port ?? "internal"}-${port.type ?? "any"}`}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
                    >
                      포트 {formatDockerPortLabel(port)}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    포트 정보 없음
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {container.networks.length > 0 ? (
                  container.networks.map((network) => (
                    <span
                      key={`${container.name}-${network}`}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                    >
                      네트워크 {network}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    네트워크 정보 없음
                  </span>
                )}
              </div>

              <p className="mt-3 text-xs text-sky-700">
                {container.ports.length > 0
                  ? `선택 시 서비스 이름, 업스트림 호스트, 업스트림 포트 ${getSuggestedUpstreamPort(container)}를 채웁니다.`
                  : "선택 시 서비스 이름과 업스트림 호스트를 채우고, 포트는 기본값 80으로 설정합니다."}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

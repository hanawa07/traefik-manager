import { Search } from "lucide-react";

import type { DockerContainer, DockerContainerListResponse, DockerTraefikCandidate } from "@/features/docker/api/dockerApi";
import Modal from "@/shared/components/Modal";
import { formatDockerPortLabel, getSuggestedUpstreamPort } from "./serviceFormUtils";

export type ContainerImportMode = "basic" | "traefik";
export type TraefikImportCandidate = DockerTraefikCandidate & {
  containerName: string;
  image: string | null;
  networks: string[];
};

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

function getDockerErrorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  const message = error instanceof Error ? error.message : null;
  return detail || message || "컨테이너 목록을 가져오지 못했습니다.";
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

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "basic" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => onModeChange("basic")}
          >
            일반 컨테이너
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "traefik" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => onModeChange("traefik")}
          >
            기존 Traefik 설정
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder={
              mode === "basic"
                ? "컨테이너 이름, 이미지, 포트, 네트워크로 검색"
                : "도메인, 컨테이너 이름, router, 네트워크로 검색"
            }
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </div>

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
          <div className="space-y-3">
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
              컨테이너 이름과 내부 포트를 가져와 업스트림을 빠르게 채웁니다. 도메인은 직접 입력하고, Manager/Traefik와
              같은 Docker 네트워크에 붙어 있는지 확인하세요.
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
                    onClick={() => onBasicImport(container)}
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
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
              기존 Docker 라벨에서 도메인, 업스트림 포트, TLS 여부를 함께 가져옵니다. 이미 Traefik Docker provider로
              운영 중인 컨테이너를 Manager로 옮길 때 쓰는 import 흐름입니다.
            </div>

            <p className="text-xs text-gray-500">
              {filteredTraefikImportCandidates.length} / {traefikImportCandidates.length}개 표시
            </p>

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {filteredTraefikImportCandidates.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  {normalizedSearchQuery
                    ? "검색 조건과 일치하는 Traefik 라벨 후보가 없습니다."
                    : "가져올 Traefik 라벨 후보가 없습니다. `traefik.http.routers.*.rule=Host(...)` 라벨이 있는 컨테이너만 여기에 표시됩니다."}
                </p>
              ) : (
                filteredTraefikImportCandidates.map((candidate) => (
                  <button
                    key={`${candidate.containerName}-${candidate.router_name}-${candidate.domain}`}
                    type="button"
                    className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                    onClick={() => onTraefikImport(candidate)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{candidate.domain}</p>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {candidate.containerName} · {candidate.image || "이미지 정보를 확인할 수 없습니다"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          candidate.tls_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {candidate.tls_enabled ? "TLS 감지" : "HTTP 감지"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                        router {candidate.router_name}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                        port {candidate.upstream_port}
                      </span>
                      {candidate.networks.map((network) => (
                        <span
                          key={`${candidate.containerName}-${candidate.router_name}-${network}`}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          {network}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 text-xs text-indigo-700">
                      선택 시 서비스 이름, 도메인, 업스트림 호스트/포트, TLS 설정을 함께 채웁니다.
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

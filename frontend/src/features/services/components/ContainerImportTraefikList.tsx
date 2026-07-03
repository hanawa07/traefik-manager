import type { TraefikImportCandidate } from "./containerImportTypes";

interface ContainerImportTraefikListProps {
  traefikImportCandidates: TraefikImportCandidate[];
  filteredTraefikImportCandidates: TraefikImportCandidate[];
  normalizedSearchQuery: string;
  onImport: (candidate: TraefikImportCandidate) => void;
}

export default function ContainerImportTraefikList({
  traefikImportCandidates,
  filteredTraefikImportCandidates,
  normalizedSearchQuery,
  onImport,
}: ContainerImportTraefikListProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
        기존 Docker 라벨에서 도메인, 업스트림 포트, TLS 여부를 함께 가져옵니다. 이미 Traefik Docker provider로 운영 중인
        컨테이너를 Manager로 옮길 때 쓰는 import 흐름입니다. `traefik.enable=true`만 있으면 부족하고
        `traefik.http.routers.*.rule=Host(...)` 라벨이 있어야 후보로 표시됩니다.
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
              onClick={() => onImport(candidate)}
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
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    candidate.networks.includes("proxy_net")
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {candidate.networks.includes("proxy_net") ? "proxy_net 연결됨" : "proxy_net 미연결"}
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
  );
}

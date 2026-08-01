import type { TraefikImportCandidate } from "./containerImportTypes";
import { ContainerImportTraefikItem } from "./ContainerImportTraefikItem";

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
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
        기존 Docker 라벨에서 도메인, 업스트림 포트, TLS 여부를 함께 가져옵니다. 이미 Traefik Docker provider로 운영 중인
        컨테이너를 Manager로 옮길 때 쓰는 import 흐름입니다. `traefik.enable=true`만 있으면 부족하고
        `traefik.http.routers.*.rule=Host(...)` 라벨이 있어야 후보로 표시됩니다.
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400">
        {filteredTraefikImportCandidates.length} / {traefikImportCandidates.length}개 표시
      </p>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {filteredTraefikImportCandidates.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
            {normalizedSearchQuery
              ? "검색 조건과 일치하는 Traefik 라벨 후보가 없습니다."
              : "가져올 Traefik 라벨 후보가 없습니다. `traefik.http.routers.*.rule=Host(...)` 라벨이 있는 컨테이너만 여기에 표시됩니다."}
          </p>
        ) : (
          filteredTraefikImportCandidates.map((candidate) => (
            <ContainerImportTraefikItem
              key={`${candidate.containerName}-${candidate.router_name}-${candidate.domain}`}
              candidate={candidate}
              onImport={onImport}
            />
          ))
        )}
      </div>
    </div>
  );
}

import { withRecommendedGatewayUpstream } from "./containerImportApply";
import type { TraefikImportCandidate } from "./containerImportTypes";
import { ContainerImportNetworkNotice } from "./ContainerImportNetworkNotice";

interface ContainerImportTraefikItemProps {
  candidate: TraefikImportCandidate;
  onImport: (candidate: TraefikImportCandidate) => void;
}

export function ContainerImportTraefikItem({
  candidate,
  onImport,
}: ContainerImportTraefikItemProps) {
  const recommendedGateway = candidate.recommendedGateway;

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="w-full p-4 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
        onClick={() => onImport(candidate)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
              {candidate.domain}
            </p>
            <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">
              {candidate.containerName} · {candidate.image || "이미지 정보를 확인할 수 없습니다"}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              candidate.tls_enabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {candidate.tls_enabled ? "TLS 감지" : "HTTP 감지"}
          </span>
        </div>

        {candidate.isRecommendedGateway ? (
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            같은 Compose 추천 gateway
          </span>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
            router {candidate.router_name}
          </span>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
            port {candidate.upstream_port}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              candidate.networks.includes("proxy_net")
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
            }`}
          >
            {candidate.networks.includes("proxy_net") ? "proxy_net 연결됨" : "proxy_net 미연결"}
          </span>
          {candidate.networks.map((network) => (
            <span
              key={`${candidate.containerName}-${candidate.router_name}-${network}`}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {network}
            </span>
          ))}
        </div>

        <ContainerImportNetworkNotice
          networks={candidate.networks}
          recommendedGatewayName={recommendedGateway?.containerName}
        />

        <p className="mt-3 text-xs text-indigo-700 dark:text-indigo-300">
          이 컨테이너 값 그대로 가져오기
        </p>
      </button>

      {recommendedGateway ? (
        <div className="border-t border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <button
            type="button"
            className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-left text-xs font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            onClick={() => onImport(withRecommendedGatewayUpstream(candidate))}
          >
            추천 gateway로 가져오기 · {recommendedGateway.containerName}:
            {recommendedGateway.upstreamPort}
            <span className="mt-1 block font-normal text-emerald-100">
              현재 도메인과 TLS는 유지하고 업스트림만 전환합니다.
            </span>
          </button>
        </div>
      ) : null}
    </article>
  );
}

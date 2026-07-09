import type { DockerContainer } from "@/features/docker/api/dockerApi";

import { formatDockerPortLabel, getSuggestedUpstreamPort } from "./serviceFormUtils";

interface ContainerImportBasicItemProps {
  container: DockerContainer;
  onImport: (container: DockerContainer) => void;
}

export function ContainerImportBasicItem({
  container,
  onImport,
}: ContainerImportBasicItemProps) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
      onClick={() => onImport(container)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{container.name}</p>
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">
            {container.image || "이미지 정보를 확인할 수 없습니다"}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-600 dark:bg-slate-800 dark:text-slate-300">
          {container.state || "unknown"}
        </span>
      </div>

      {container.status ? <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{container.status}</p> : null}

      <ContainerPortBadges container={container} />
      <ContainerNetworkBadges container={container} />

      <p className="mt-3 text-xs text-sky-700 dark:text-sky-300">
        {container.ports.length > 0
          ? `선택 시 서비스 이름, 업스트림 호스트, 업스트림 포트 ${getSuggestedUpstreamPort(container)}를 채웁니다.`
          : "선택 시 서비스 이름과 업스트림 호스트를 채우고, 포트는 기본값 80으로 설정합니다."}
      </p>
    </button>
  );
}

function ContainerPortBadges({ container }: { container: DockerContainer }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {container.ports.length > 0 ? (
        container.ports.map((port) => (
          <span
            key={`${container.name}-${port.private_port}-${port.public_port ?? "internal"}-${port.type ?? "any"}`}
            className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
          >
            포트 {formatDockerPortLabel(port)}
          </span>
        ))
      ) : (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
          포트 정보 없음
        </span>
      )}
    </div>
  );
}

function ContainerNetworkBadges({ container }: { container: DockerContainer }) {
  const hasProxyNetwork = container.networks.includes("proxy_net");

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          hasProxyNetwork ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
        }`}
      >
        {hasProxyNetwork ? "proxy_net 연결됨" : "proxy_net 미연결"}
      </span>
      {container.networks.length > 0 ? (
        container.networks.map((network) => (
          <span
            key={`${container.name}-${network}`}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            네트워크 {network}
          </span>
        ))
      ) : (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          네트워크 정보 없음
        </span>
      )}
    </div>
  );
}
